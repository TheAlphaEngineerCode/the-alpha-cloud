/**
 * Seed the demo organisation and a sysadmin user. Used by `make db-seed` for the Cloud
 * Simulator scenario set (spec §55). Phase 1 ships only the org/user seed; further
 * scenarios are added in Phase 2+ when the simulator connector exists.
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '@cloud/auth';
import type { TypedPool } from '@cloud/database';

const SEED_ORG_NAME = 'Alpha Cloud Labs';
const SEED_ORG_SLUG = 'alpha-cloud-labs';
const SEED_USER_EMAIL = 'demo@cloud.test';
const SEED_DISPLAY_NAME = 'Demo Operator';
const SEED_USER_PASSWORD = 'Cloud-Demo-12345!';

export interface SeedResult {
  readonly organizationId: string;
  readonly userId: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
}

export async function seedDemo(pool: TypedPool): Promise<SeedResult> {
  const orgId = randomUUID();
  const userId = randomUUID();
  const passwordHash = await hashPassword(SEED_USER_PASSWORD);

  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1',
    [SEED_ORG_SLUG],
    (r) => ({ id: String(r.id) }),
  );
  if (existing.length > 0) {
    return {
      organizationId: existing[0]!.id,
      userId,
      adminEmail: SEED_USER_EMAIL,
      adminPassword: SEED_USER_PASSWORD,
    };
  }

  await pool.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`,
      [orgId, SEED_ORG_NAME, SEED_ORG_SLUG],
    );
    await tx.execute(
      `INSERT INTO users (id, email, password_hash, display_name, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [userId, SEED_USER_EMAIL, passwordHash, SEED_DISPLAY_NAME],
    );
    await tx.execute(
      `INSERT INTO memberships (organization_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [orgId, userId],
    );
  });

  return {
    organizationId: orgId,
    userId,
    adminEmail: SEED_USER_EMAIL,
    adminPassword: SEED_USER_PASSWORD,
  };
}

async function main() {
  const { loadEnv } = await import('@cloud/config');
  const { initPool } = await import('./pool.js');
  const { applyMigrations } = await import('./migrate.js');
  const env = loadEnv();
  const pool = initPool(env);
  try {
    await applyMigrations(pool);
    const result = await seedDemo(pool);
    // eslint-disable-next-line no-console
    console.log('[cloud] seed done:', {
      organizationId: result.organizationId,
      adminEmail: result.adminEmail,
      adminPassword: '(hidden — check `.env` for the value)',
    });
  } finally {
    await pool.close();
  }
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error('seed failed:', err);
    process.exitCode = 1;
  });
}