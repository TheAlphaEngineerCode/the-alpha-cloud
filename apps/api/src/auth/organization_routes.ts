/**
 * Organization management routes — list/switch/create. Tenant-scoped via RBAC decorators.
 */
import type { FastifyInstance } from 'fastify';
import type { AppDeps } from './context.js';
import { BadRequest, Forbidden, Unauthorized } from './context.js';
import { slugSchema, displayNameSchema } from '@cloud/validation';
import type { Repositories } from '../db/repositories.js';

const createBody = (body: unknown) => {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const name = displayNameSchema.safeParse(b.name);
  const slug = slugSchema.safeParse(b.slug);
  if (!name.success || !slug.success) return null;
  return { name: name.data, slug: slug.data };
};

export interface OrgRoutesDeps {
  readonly deps: AppDeps;
  readonly repos: Repositories;
}

export function organizationRoutes(opts: OrgRoutesDeps): (app: FastifyInstance) => void {
  const { repos } = opts;
  return (app) => {
    app.get('/organizations', async (request, reply) => {
      if (!request.cloud.user) throw new Unauthorized();
      const orgs = await repos.organizations.listForUser(request.cloud.user.id);
      return reply.code(200).send({
        organizations: orgs.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          role: o.role,
        })),
      });
    });

    app.post('/organizations', async (request, reply) => {
      if (!request.cloud.user) throw new Unauthorized();
      const body = createBody(request.body);
      if (!body) throw new BadRequest('invalid payload');
      const existing = await repos.organizations.findBySlug(body.slug);
      if (existing) throw new Forbidden('org slug taken');

      const org = await repos.organizations.insert({ name: body.name, slug: body.slug });
      await repos.memberships.insert({
        organizationId: org.id,
        userId: request.cloud.user.id,
        role: 'OWNER',
      });

      request.auditPatch = {
        action: 'organization.created',
        resourceType: 'organization',
        resourceId: org.id,
        after: { name: org.name, slug: org.slug },
      };

      return reply.code(201).send({
        organization: { id: org.id, name: org.name, slug: org.slug },
      });
    });
  };
}
