/**
 * RBAC helpers — preHandler decorators that fail-closed on missing/insufficient auth.
 *
 * Usage:
 *   app.post('/deployments', { preHandler: [requireAuth, requirePermission('deployment.create')] }, handler)
 *
 * The tenant middleware runs first (registered at app-level), populating `request.cloud`.
 * These decorators read from `request.cloud` and never revalidate the session cookie.
 */
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { can } from '@cloud/permissions';
import type { Permission } from '@cloud/domain';
import { Forbidden, Unauthorized } from './context.js';

/**
 * All RBAC decorators are async preHandlers. Fastify 5 requires the async shape
 * (sync arity-2 returning void silently stalls the request).
 */
type AsyncPreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

/** 401 unless the request carries an authenticated user. */
export const requireAuth: AsyncPreHandler = async (request, _reply) => {
  if (!request.cloud.user) throw new Unauthorized();
};

/** 401 if no user; 403 if no tenant or missing the permission. */
export function requirePermission(permission: Permission): AsyncPreHandler {
  return async (request, _reply) => {
    if (!request.cloud.user) throw new Unauthorized();
    if (!request.cloud.tenant) throw new Forbidden('no active tenant');
    if (!can(request.cloud.tenant.role, permission)) {
      throw new Forbidden(`missing permission: ${permission}`);
    }
  };
}

/** 401 if no user; 403 if tenant === null OR role !== ROLE.OWNER. */
export const requireOwner: AsyncPreHandler = async (request, _reply) => {
  if (!request.cloud.user) throw new Unauthorized();
  if (!request.cloud.tenant) throw new Forbidden('no active tenant');
  if (request.cloud.tenant.role !== 'OWNER') {
    throw new Forbidden('owner-only action');
  }
};

/** 401 if no user; 403 if tenant === null OR role not in ADMIN/OWNER. */
export const requireAdmin: AsyncPreHandler = async (request, _reply) => {
  if (!request.cloud.user) throw new Unauthorized();
  if (!request.cloud.tenant) throw new Forbidden('no active tenant');
  if (request.cloud.tenant.role !== 'OWNER' && request.cloud.tenant.role !== 'ADMIN') {
    throw new Forbidden('admin-only action');
  }
};

// Re-export the Fastify-style type for backwards compatibility with callers that type
// their fields as `preHandlerHookHandler` (still works as it's a Promise-returning fn).
export type { preHandlerHookHandler };