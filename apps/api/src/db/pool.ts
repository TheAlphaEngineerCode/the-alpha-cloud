/**
 * Postgres pool construction bound to the typed config object.
 *
 * Why a separate factory: tests want to plug in `pg-mem` without env reads; production
 * uses the real `pg.Pool`. The factory defaults to env-driven configuration, but accepts
 * an external `Pool` so tests can swap implementations.
 */
import { buildPool, wrapPool, type TypedPool } from '@cloud/database';
import type { Env } from '@cloud/config';
import type { Pool } from 'pg';

export function buildPoolFromEnv(env: Env): TypedPool {
  const connectionString =
    env.DATABASE_URL ??
    `postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`;
  const pool = buildPool({
    connectionString,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_POOL_IDLE,
  });
  return wrapPool(pool);
}

export function wrapExternalPool(pool: Pool): TypedPool {
  return wrapPool(pool);
}

let singleton: TypedPool | undefined;

/**
 * Synchronously returns the cached pool. Returns null if not yet initialised.
 * Production code initialises the pool at startup via `initPool` (which accepts an
 * explicit `Env`). Tests bypass this entirely by passing the pool to `buildApp`.
 */
export function getPool(): TypedPool | null {
  return singleton ?? null;
}

/** Initialise the global pool from an env object. Idempotent. */
export function initPool(env: Env): TypedPool {
  if (!singleton) singleton = buildPoolFromEnv(env);
  return singleton;
}

export function setPoolForTesting(pool: TypedPool | undefined): void {
  singleton = pool;
}