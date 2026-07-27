/**
 * Audit inspection route — READ-ONLY listing of audit rows scoped to the active tenant.
 *
 * Required permission: `audit.read`. Cross-tenant reads are impossible — the query
 * binds to `request.cloud.tenant.organizationId`.
 */
import type { FastifyInstance } from 'fastify';
import type { AppDeps } from './context.js';
import { Unauthorized } from './context.js';
import { requirePermission } from './rbac.js';
import type { Repositories } from '../db/repositories.js';

export interface AuditRoutesDeps {
  readonly deps: AppDeps;
  readonly repos: Repositories;
}

export function auditRoutes(opts: AuditRoutesDeps): (app: FastifyInstance) => void {
  const { repos } = opts;
  return (app) => {
    app.get(
      '/audit',
      { preHandler: [requirePermission('audit.read')] },
      async (request, reply) => {
        const limit = parseLimit(request.query);
        const orgId = request.cloud.tenant!.organizationId;
        const rows = await repos.audit.listForOrganization(orgId, limit);
        return reply.code(200).send({
          audit: rows.map((r) => ({
            id: r.id,
            action: r.action,
            resourceType: r.resourceType,
            resourceId: r.resourceId,
            actorId: r.actorId,
            timestamp: r.timestamp.toISOString(),
            ip: r.ip,
            correlationId: r.correlationId,
          })),
        });
      },
    );
  };
}

function parseLimit(query: unknown): number {
  if (typeof query !== 'object' || query === null) return 50;
  const q = query as Record<string, unknown>;
  const raw = q['limit'];
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : 50;
  if (!Number.isFinite(n) || n < 1 || n > 200) return 50;
  return n;
}

export { Unauthorized };