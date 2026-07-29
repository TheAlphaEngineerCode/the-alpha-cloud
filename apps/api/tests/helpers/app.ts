/**
 * Shared test harness — builds an in-memory fastify app + memory repositories + a fresh
 * bus. No DB needed.
 *
 * Tests are deterministic and side-effect free between calls — `buildMemoryRepositories`
 * creates a fresh repository set per invocation.
 */
import { buildApp } from '../../src/server.js';
import type { AppDeps } from '../../src/auth/context.js';
import { InMemoryEventBus } from '@cloud/events';
import type { EventBus } from '@cloud/events';
import { buildMemoryRepositories, type MemoryRepositories } from '../memory/repositories.js';

export interface TestApp {
  readonly app: import('fastify').FastifyInstance;
  readonly deps: AppDeps;
  readonly repos: MemoryRepositories;
  readonly bus: EventBus;
  close(): Promise<void>;
}

export async function buildTestApp(bus: EventBus = new InMemoryEventBus()): Promise<TestApp> {
  const repos = buildMemoryRepositories();
  const deps: AppDeps = {
    repos,
    bus,
    sessionCookieName: 'cloud_session',
    sessionCookieDomain: null,
    sessionCookieSecure: false,
    sessionCookieSameSite: 'lax',
    sessionTtlSeconds: 60 * 60,
    corsOrigins: ['http://localhost:3000'],
    rateLimitAuthMax: 1000,
    rateLimitAuthWindowSeconds: 60,
    rateLimitGeneralMax: 1000,
    rateLimitGeneralWindowSeconds: 60,
  };
  const app = await buildApp({ deps, repos, bus, withHelmet: false, withDocs: false });
  return {
    app,
    deps,
    repos,
    bus,
    close: () => app.close(),
  };
}

/** Helper: parse the set-cookie header into a cookie map. */
export function parseSetCookies(setCookie: string | string[] | undefined): Record<string, string> {
  if (!setCookie) return {};
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  const out: Record<string, string> = {};
  for (const c of arr) {
    const eq = c.indexOf('=');
    if (eq === -1) continue;
    const key = c.slice(0, eq);
    const value = c.slice(eq + 1).split(';')[0] ?? '';
    out[key] = value;
  }
  return out;
}

/** Helper: register a demo user/org and return a session cookie. */
export async function register(
  app: import('fastify').FastifyInstance,
  body: { email: string; password: string; displayName: string; orgName: string; orgSlug: string },
): Promise<{
  cookie: string;
  user: { id: string };
  organization: { id: string };
  sessionId: string;
}> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: body,
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const cookies = parseSetCookies(res.headers['set-cookie']);
  const json = JSON.parse(res.body) as {
    user: { id: string };
    organization: { id: string };
    sessionId: string;
  };
  return {
    cookie: `cloud_session=${cookies['cloud_session'] ?? ''}`,
    user: json.user,
    organization: json.organization,
    sessionId: json.sessionId,
  };
}

export async function login(
  app: import('fastify').FastifyInstance,
  email: string,
  password: string,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  const cookies = parseSetCookies(res.headers['set-cookie']);
  return `cloud_session=${cookies['cloud_session'] ?? ''}`;
}
