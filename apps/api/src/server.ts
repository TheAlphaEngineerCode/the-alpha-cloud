/**
 * Server factory — `buildApp(deps)` returns an unstarted Fastify instance wired with
 * everything. Tests use it without binding a port; CLI uses `app.listen`.
 */
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import type { AppDeps } from './auth/context.js';
import type { Repositories } from './db/repositories.js';
import type { EventBus } from '@cloud/events';

import {
  BadRequest,
  Conflict,
  Forbidden,
  Unauthorized,
} from './auth/context.js';

import { buildTenantMiddleware } from './auth/tenant_middleware.js';
import { auditOnSend, auditPreHandler } from './auth/audit.js';
import { authRoutes } from './auth/routes.js';
import { organizationRoutes } from './auth/organization_routes.js';
import { auditRoutes } from './auth/audit_routes.js';

import type { TypedPool } from '@cloud/database';

export interface BuildAppOptions {
  readonly deps: AppDeps;
  readonly repos: Repositories;
  readonly bus: EventBus;
  /** When true, mounts swagger UI at /docs. Defaults to true. */
  readonly withDocs?: boolean;
  /** When true, mounts helmet. Disable in tests that need a more permissive CSP. */
  readonly withHelmet?: boolean;
}

export interface AppHandle {
  readonly app: FastifyInstance;
  readonly deps: AppDeps;
  readonly repos: Repositories;
  readonly bus: EventBus;
  readonly pool?: TypedPool;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { deps, repos, bus, withDocs = true, withHelmet = true } = opts;
  const app = Fastify({
    logger: false, // tests inject their own; production re-instantiates via @cloud/logger
    trustProxy: true,
    bodyLimit: 1024 * 1024, // 1 MiB
    ajv: { customOptions: { strict: true } },
  });

  // Decorates so handlers can reach deps/repos from the request instance if needed.
  app.decorate('cloudDeps', deps);
  app.decorate('cloudRepos', repos);

  // ─────────────────────── plugins ─────────────────────────────────────────────
  await app.register(cookie, {});
  if (withHelmet) await app.register(helmet, {});
  await app.register(cors, {
    origin: Array.from(deps.corsOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'X-Request-Id'],
    exposedHeaders: ['X-Correlation-Id'],
  });
  await app.register(rateLimit, {
    global: true,
    max: deps.rateLimitGeneralMax,
    timeWindow: `${deps.rateLimitGeneralWindowSeconds} seconds`,
    // Auth routes get their own bucket.
    keyGenerator: (req) => (req.url.startsWith('/auth/') ? `auth:${req.ip}` : `gen:${req.ip}`),
  });

  if (withDocs) {
    await app.register(swagger, {
      swagger: {
        info: {
          title: 'The Alpha Cloud API',
          version: '0.0.0',
          description: 'Cloud Infrastructure Control Plane — API surface',
        },
        consumes: ['application/json'],
        produces: ['application/json'],
        security: [{ cookieSession: [] }],
      },
    });
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: false },
      staticCSP: true,
    });
  }

  // ─────────────────────── middleware ──────────────────────────────────────────
  app.addHook('preHandler', buildTenantMiddleware(deps, repos));
  app.addHook('preHandler', auditPreHandler(deps));

  // ─────────────────────── auth scanned routes ──────────────────────────────────
  app.addHook('preHandler', async (request, _reply) => {
    // Auth bucket override: limit auth routes to a tighter limit
    if (request.url.startsWith('/auth/')) {
      const httpServer = request.server as unknown as { _limitPerWindow?: number } | undefined;
      // We cannot easily override per-route rate; rely on keyGenerator bucketing.
      // Track a per-IP auth counter in fastify-rate-limit by URL prefix.
      void httpServer;
    }
  });
  // Auth routes themselves are registered next; the hook above is intentionally empty.

  // ─────────────────────── error responses ────────────────────────────────────
  app.setErrorHandler((err: FastifyError, request, reply) => {
    const status =
      err.statusCode ??
      (err instanceof Unauthorized ? 401
       : err instanceof Forbidden ? 403
       : err instanceof BadRequest ? 400
       : err instanceof Conflict ? 409
       : 500);
    if (status >= 500) {
      request.log?.error?.(err, 'server error');
    }
    return reply.code(status).send({
      error: err.name ?? 'Error',
      message: err.message,
      statusCode: status,
      ...(err instanceof BadRequest && err.fields ? { fields: err.fields } : null),
    });
  });

  // onSend — write audit rows after handlers complete (including 4xx/5xx)
  app.addHook('onSend', auditOnSend(deps, repos));

  // ─────────────────────── routes ─────────────────────────────────────────────
  await app.register(authRoutes({ deps, repos, bus }));
  await app.register(organizationRoutes({ deps, repos }));
  await app.register(auditRoutes({ deps, repos }));

  // ─────────────────────── health checks ─────────────────────────────────────
  app.get('/health', async (_req, reply) => {
    await reply.code(200).send({ status: 'ok' });
  });
  app.get('/ready', async (_req, reply) => {
    try {
      await repos.audit.listForOrganization(
        '00000000-0000-0000-0000-000000000000' as never,
        1,
      );
      await reply.code(200).send({ status: 'ready' });
    } catch (err) {
      await reply.code(503).send({
        status: 'not-ready',
        err: err instanceof Error ? err.message : String(err),
      });
    }
  });
  app.get('/metrics', async (_req, reply) => {
    // Prometheus format exported by Observability phase; stub for now.
    await reply
      .code(200)
      .header('content-type', 'text/plain; version=0.0.4')
      .send('# cloud_platform_up 1\n');
  });

  return app;
}