/**
 * App entrypoint — `apps/api`. Binds the typed env, builds the pool, applies migrations
 * (idempotent), constructs the Fastify app, listens on env.API_PORT.
 */
import { buildLogger } from '@cloud/logger';
import { InMemoryEventBus } from '@cloud/events';
import { initPool } from './db/pool.js';
import { buildPgRepositories } from './db/pg_repositories.js';
import { applyMigrations } from './db/migrate.js';
import { buildApp } from './server.js';

async function start() {
  const { loadEnv } = await import('@cloud/config');
  const env = loadEnv();
  const log = buildLogger({ level: env.LOG_LEVEL });

  const pool = initPool(env);
  try {
    await applyMigrations(pool);
  } catch (err) {
    log.error({ err }, 'migration failed');
    throw err;
  }
  const repos = buildPgRepositories(pool);
  const bus = new InMemoryEventBus();

  const deps = {
    repos,
    bus,
    sessionCookieName: env.SESSION_COOKIE_NAME,
    sessionCookieDomain: null,
    sessionCookieSecure: env.NODE_ENV === 'production',
    sessionCookieSameSite: 'lax' as const,
    sessionTtlSeconds: env.SESSION_TTL_SECONDS,
    corsOrigins: env.CORS_ORIGINS,
    rateLimitAuthMax: env.RATE_LIMIT_AUTH_MAX,
    rateLimitAuthWindowSeconds: env.RATE_LIMIT_AUTH_WINDOW_SECONDS,
    rateLimitGeneralMax: env.RATE_LIMIT_GENERAL_MAX,
    rateLimitGeneralWindowSeconds: env.RATE_LIMIT_GENERAL_WINDOW_SECONDS,
  };

  const app = await buildApp({ deps, repos, bus });
  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
    log.info({ host: env.API_HOST, port: env.API_PORT }, 'The Alpha Cloud API listening');
  } catch (err) {
    log.error({ err }, 'listen failed');
    await app.close();
    await pool.close();
    bus.close();
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }

  const shutdown = (signal: string) => {
    log.info({ signal }, 'shutting down');
    void (async () => {
      await app.close();
      await pool.close();
      bus.close();
      // eslint-disable-next-line no-process-exit
      process.exit(0);
    })();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('startup crashed:', err);
  // Process start is intentional here — Fastify lifecycle has already closed, we
  // can't unwind via throw because start() is the top of the call stack.
  // eslint-disable-next-line no-process-exit
  process.exit(1);
});