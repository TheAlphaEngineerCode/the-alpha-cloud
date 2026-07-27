/**
 * Tenant middleware — resolves the per-request `cloud` context from session cookie.
 *
 * Behaviour:
 *  - When no session cookie → unauthenticated (`cloud.tenant === null`).
 *  - When session exists but tenant is unbound → member is logged in but with `tenant === null`.
 *    Endpoints that require a tenant return 403.
 *  - When session exists and is expired/revoked → treat as unauthenticated.
 *
 * The `cloud.tenant` field is the ONLY place handlers may read the tenant — never the
 * cookie, never a query string, never the body. ADR-0009 enforcement.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppDeps, RequestContext } from './context.js';
import { readSessionToken } from './sessions.js';
import type { Session, User } from '@cloud/domain';
import type { Repositories } from '../db/repositories.js';
import { hashToken } from '@cloud/auth';

// Public fastify augmentation types. Declared once here and consumed everywhere.
declare module 'fastify' {
  interface FastifyInstance {
    readonly cloudDeps: AppDeps;
    readonly cloudRepos: Repositories;
  }
  interface FastifyRequest {
    cloud: RequestContext;
  }
}

const UNAUTHENTICATED: RequestContext = {
  sessionId: null,
  user: null,
  tenant: null,
};

export type TenantMiddleware = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export function buildTenantMiddleware(
  deps: AppDeps,
  repos: Repositories,
): TenantMiddleware {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    request.cloud = UNAUTHENTICATED;

    const token = readSessionToken(request, deps);
    if (!token) return;

    const tokenHash = await hashToken(token);
    const session = await repos.sessions.findByTokenHash(tokenHash);
    if (!session || isExpiredOrRevoked(session)) return;

    const user = await repos.users.findById(session.userId);
    if (!user || user.status !== 'ACTIVE') return;

    const tenant =
      session.organizationId && session.role
        ? { organizationId: session.organizationId, role: session.role }
        : null;

    request.cloud = {
      sessionId: session.id,
      user,
      tenant,
    };
  };
}

export function isExpiredOrRevoked(session: Session): boolean {
  if (session.revokedAt) return true;
  if (session.expiresAt.getTime() < Date.now()) return true;
  return false;
}

// Re-export `User` so callers don't need a second import path.
export type { User, Session };