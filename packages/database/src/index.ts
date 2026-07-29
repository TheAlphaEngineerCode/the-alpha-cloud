/**
 * @cloud/database — minimal PostgreSQL pool wrapper with strict typing helpers.
 *
 * Why no ORM (ADR-0003): SQL is reviewable, survives framework churn, and the
 * platform's main payload is SQL fluency. Instead, we expose a thin typed query
 * helper. Callers pass a row decoder that converts the raw query result into a
 * domain object, failing loudly on shape mismatch (no silent `undefined`).
 */
import pg, { type Pool, type PoolConfig, type QueryResult } from 'pg';

export type { Pool, PoolConfig, QueryResult } from 'pg';

export interface BuildPoolOptions {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number;
  idleTimeoutMillis?: number;
  /** Logging hook — defaults to no-op. */
  onConnectError?: (err: Error) => void;
}

/** Build a `pg.Pool` from explicitly-passed options — no implicit env reads. */
export function buildPool(opts: BuildPoolOptions): Pool {
  const cfg: PoolConfig = {
    connectionString: opts.connectionString,
    host: opts.host,
    port: opts.port,
    database: opts.database,
    user: opts.user,
    password: opts.password,
    max: opts.max,
    idleTimeoutMillis: opts.idleTimeoutMillis,
  };
  const pool = new pg.Pool(cfg);
  pool.on('error', (err) => {
    if (opts.onConnectError) opts.onConnectError(err);
    else console.error('[cloud] idle pg pool error:', err.message);
  });
  return pool;
}

/**
 * Primitives Postgres touches return paths through `pg-types`:
 * - text/uuid/varchar  → string
 * - int4/int8/numeric   → number (numeric only if not bigint)
 * - timestamptz/timestamp → Date
 * - boolean             → boolean
 * - json/jsonb          → unknown (whatever JSON decoded into)
 *
 * `RowDecoder` accepts the most general safe type — JSONB stays `unknown`, typed
 * columns can be narrowed without `unknown` casts at every access site.
 */
export type PgScalar = string | number | boolean | Date | null;
export type PgRow = Record<string, unknown>;

/**
 * Map a Postgres row (`pg` returns rows as plain objects) into a typed domain object
 * using `decoder`. Centralized so all API endpoints use the same shape contract.
 *
 * Rationale: `pg-types` provides primitives but not row-level guarantees. The decoder
 * function inspects each column explicitly — no implicit coercion.
 */
export interface RowDecoder<T> {
  (row: PgRow): T;
}

/**
 * Narrowing helpers — accept `unknown` and reject anything outside a strict set of
 * allowed Postgres scalar types. They throw on unexpected types rather than producing
 * `'[object Object]'`, which is what the `@typescript-eslint/no-base-to-string` rule
 * is here to detect.
 */
export function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  throw new TypeError(`expected string, got ${typeof value}`);
}

export function asOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return asString(value);
}

export function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  throw new TypeError(`expected number, got ${typeof value}`);
}

export function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  throw new TypeError(`expected date, got ${typeof value}`);
}

export function asOptionalDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return asDate(value);
}

export interface TypedPool {
  query<T>(
    text: string,
    params: ReadonlyArray<unknown>,
    decoder: RowDecoder<T>,
  ): Promise<readonly T[]>;
  queryOne<T>(
    text: string,
    params: ReadonlyArray<unknown>,
    decoder: RowDecoder<T>,
  ): Promise<T | null>;
  execute(text: string, params: ReadonlyArray<unknown>): Promise<QueryResult>;
  transaction<T>(fn: (tx: TypedTx) => Promise<T>): Promise<T>;
  pool: Pool;
  close(): Promise<void>;
}

export interface TypedTx extends Omit<TypedPool, 'transaction' | 'close' | 'pool'> {
  /** The underlying `pg.Client` for the transaction. Callers should rarely need it. */
  client: pg.PoolClient;
}

/**
 * Wrap a raw `pg.Pool` into the typed surface the rest of the platform uses.
 */
export function wrapPool(pool: Pool): TypedPool {
  const query = async <T>(
    text: string,
    params: ReadonlyArray<unknown>,
    decoder: RowDecoder<T>,
  ): Promise<readonly T[]> => {
    const res = await pool.query(text, params as unknown[]);
    return res.rows.map((r) => decoder(r as Record<string, unknown>));
  };
  const queryOne = async <T>(
    text: string,
    params: ReadonlyArray<unknown>,
    decoder: RowDecoder<T>,
  ): Promise<T | null> => {
    const rows = await query(text, params, decoder);
    return rows.length === 0 ? null : rows[0]!;
  };
  const execute = (text: string, params: ReadonlyArray<unknown>): Promise<QueryResult> =>
    pool.query(text, params as unknown[]);

  const transaction = async <T>(fn: (tx: TypedTx) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx: TypedTx = {
        client,
        query: async (text, params, decoder) => {
          const res = await client.query(text, params as unknown[]);
          return res.rows.map((r) => decoder(r as Record<string, unknown>));
        },
        queryOne: async (text, params, decoder) => {
          const res = await client.query(text, params as unknown[]);
          const rows = res.rows.map((r) => decoder(r as Record<string, unknown>));
          return rows.length === 0 ? null : rows[0]!;
        },
        execute: (text, params) => client.query(text, params as unknown[]),
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  return {
    query,
    queryOne,
    execute,
    transaction,
    pool,
    close: () => pool.end(),
  };
}
