/**
 * Drop the database schema — used by `make db-reset` and CI test bootstrap.
 * Destructive: this is intentionally simple. The command in the Makefile has a sleep
 * and asks for confirmation.
 */
import { fileURLToPath } from 'node:url';
import type { TypedPool } from '@cloud/database';

const DROP_SQL = `
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS audit_events CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;
`;

export async function dropAll(pool: TypedPool): Promise<void> {
  await pool.execute(DROP_SQL, []);
}

async function main() {
  const { loadEnv } = await import('@cloud/config');
  const { initPool } = await import('./pool.js');
  const env = loadEnv();
  const pool = initPool(env);
  try {
    await dropAll(pool);
    // eslint-disable-next-line no-console
    console.log('[cloud] schema dropped');
  } finally {
    await pool.close();
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error('drop failed:', err);
    process.exitCode = 1;
  });
}
