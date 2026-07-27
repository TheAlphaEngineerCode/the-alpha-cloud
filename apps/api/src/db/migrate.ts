/**
 * Migration runner — applies `migrations/*.sql` in lexical order, recording each in
 * `schema_migrations`. Idempotent. Runs both as a script (`pnpm db:migrate`) and as an
 * importable function for tests.
 *
 * SQL files are kept as raw text — no knex, no prisma — so the diff is human-reviewable
 * and CI can read the schema without a CLI.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TypedPool } from '@cloud/database';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export async function applyMigrations(pool: TypedPool): Promise<string[]> {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
    [],
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    (
      await pool.query<{ version: string }>(
        'SELECT version FROM schema_migrations ORDER BY version',
        [],
        (r) => ({ version: String(r.version) }),
      )
    ).map((r) => r.version),
  );

  const newlyApplied: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;

    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    await pool.transaction(async (tx) => {
      await tx.execute(sql, []);
      await tx.execute(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version],
      );
    });
    newlyApplied.push(version);
  }
  return newlyApplied;
}

// ───────────── entrypoint when run as `pnpm db:migrate` ──────────────────────

async function main() {
  const { loadEnv } = await import('@cloud/config');
  const { initPool } = await import('./pool.js');
  const env = loadEnv();
  const pool = initPool(env);
  try {
    const applied = await applyMigrations(pool);
    // eslint-disable-next-line no-console
    console.log(
      applied.length === 0
        ? '[cloud] no new migrations'
        : `[cloud] applied: ${applied.join(', ')}`,
    );
  } finally {
    await pool.close();
  }
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error('migration failed:', err);
    process.exitCode = 1;
  });
}