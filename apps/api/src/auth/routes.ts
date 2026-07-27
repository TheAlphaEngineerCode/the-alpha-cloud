/**
 * Auth routes — register, login, logout, current session inspection.
 *
 * Security:
 *  - Registration opens a user, an organization (auto), and an OWNER membership in one tx.
 *  - Login throttled by `@fastify/rate-limit` per the auth bucket set in deps.
 *  - Logout revokes the session row and clears the cookie.
 *  - `me` returns the authenticated user + active memberships + current tenant.
 *
 * All flows write audit rows(s) via the audit hooks (POST is mutating).
 */
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  emailSchema,
  passwordSchema,
  displayNameSchema,
  slugSchema,
  randomId,
} from '@cloud/validation';
import {
  BadRequest,
  Conflict,
  Unauthorized,
  type AppDeps,
} from './context.js';
import { hashPassword, verifyPassword } from '@cloud/auth';
import { issueSession, setSessionCookie, clearSessionCookie } from './sessions.js';
import type { Repositories } from '../db/repositories.js';
import type { EventBus } from '@cloud/events';
import { buildEvent, eventId, organizationId } from '@cloud/domain';

const registerBody = (body: unknown) => {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const email = emailSchema.safeParse(b.email);
  const password = passwordSchema.safeParse(b.password);
  const displayName = displayNameSchema.safeParse(b.displayName);
  const orgName = displayNameSchema.safeParse(b.orgName ?? b['org_name']);
  const slug = slugSchema.safeParse(b.orgSlug ?? b['org_slug']);
  if (!email.success || !password.success || !displayName.success || !orgName.success || !slug.success) {
    return null;
  }
  return {
    email: email.data,
    password: password.data,
    displayName: displayName.data,
    orgName: orgName.data,
    orgSlug: slug.data,
  };
};

const loginBody = (body: unknown) => {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const email = emailSchema.safeParse(b.email);
  const password = b.password;
  if (!email.success || typeof password !== 'string') return null;
  return { email: email.data, password };
};

export interface AuthRoutesDeps {
  readonly deps: AppDeps;
  readonly repos: Repositories;
  readonly bus: EventBus;
}

export function authRoutes(opts: AuthRoutesDeps): (app: FastifyInstance) => void {
  const { deps, repos, bus } = opts;
  return (app) => {
    app.post('/auth/register', async (request, reply) => {
      const body = registerBody(request.body);
      if (!body) throw new BadRequest('invalid registration payload');

      const existing = await repos.users.findByEmail(body.email);
      if (existing) throw new Conflict('email already registered');
      const existingOrg = await repos.organizations.findBySlug(body.orgSlug);
      if (existingOrg) throw new Conflict('organization slug already taken');

      const passwordHash = await hashPassword(body.password);
      const correlationId = request._cloudCorrelation ?? randomId('corr');

      const user = await repos.users.insert({
        email: body.email,
        passwordHash,
        displayName: body.displayName,
      });
      const org = await repos.organizations.insert({ name: body.orgName, slug: body.orgSlug });
      const membership = await repos.memberships.insert({
        organizationId: org.id,
        userId: user.id,
        role: 'OWNER',
      });

      const { token, session } = await issueSession({
        repo: repos.sessions,
        userId: user.id,
        organizationId: org.id,
        role: membership.role,
        ttlSeconds: deps.sessionTtlSeconds,
        ip: request._cloudIp ?? null,
        userAgent: request.headers['user-agent'] ?? null,
      });
      setSessionCookie(reply, deps, token);

      request.auditPatch = {
        action: 'user.register',
        resourceType: 'user',
        resourceId: user.id,
        organizationId: org.id,
        after: { email: user.email, organizationId: org.id, role: membership.role },
      };

      await bus.publish(
        buildEvent({
          id: eventId(randomUUID()),
          type: 'user.registered',
          organizationId: organizationId(org.id),
          source: 'auth',
          entityId: user.id,
          correlationId,
          causationId: null,
          occurredAt: new Date(),
          payload: { userId: user.id, organizationId: org.id, role: membership.role },
        }),
      );

      return reply.code(201).send({
        user: { id: user.id, email: user.email, displayName: user.displayName },
        organization: { id: org.id, name: org.name, slug: org.slug },
        sessionId: session.id,
      });
    });

    app.post('/auth/login', async (request, reply) => {
      const body = loginBody(request.body);
      if (!body) throw new BadRequest('invalid login payload');
      const user = await repos.users.findByEmail(body.email);
      if (!user) throw new Unauthorized('invalid credentials');
      const ok = await verifyPassword(user.passwordHash, body.password);
      if (!ok) throw new Unauthorized('invalid credentials');
      if (user.status !== 'ACTIVE') throw new Unauthorized('account suspended or invited');

      // Bind the session to the user's first membership, if one exists.
      const memberships = await repos.memberships.listForUser(user.id);
      const firstMembership = memberships[0] ?? null;

      const { token, session } = await issueSession({
        repo: repos.sessions,
        userId: user.id,
        organizationId: firstMembership?.organizationId ?? null,
        role: firstMembership?.role ?? null,
        ttlSeconds: deps.sessionTtlSeconds,
        ip: request._cloudIp ?? null,
        userAgent: request.headers['user-agent'] ?? null,
      });
      setSessionCookie(reply, deps, token);

      request.auditPatch = {
        action: 'user.login',
        resourceType: 'user',
        resourceId: user.id,
        after: { sessionId: session.id, organizationId: firstMembership?.organizationId ?? null },
      };

      await bus.publish(
        buildEvent({
          id: eventId(randomUUID()),
          type: 'user.login',
          organizationId: firstMembership
            ? organizationId(firstMembership.organizationId)
            : organizationId(randomId()),
          source: 'auth',
          entityId: user.id,
          correlationId: request._cloudCorrelation ?? randomId('corr'),
          causationId: null,
          occurredAt: new Date(),
          payload: { userId: user.id, sessionId: session.id },
        }),
      );

      return reply.code(200).send({
        user: { id: user.id, email: user.email, displayName: user.displayName },
        tenant: firstMembership
          ? { organizationId: firstMembership.organizationId, role: firstMembership.role }
          : null,
      });
    });

    app.post('/auth/logout', async (request, reply) => {
      if (!request.cloud.user || !request.cloud.sessionId) {
        return reply.code(204).send();
      }
      await repos.sessions.revoke(request.cloud.sessionId);
      clearSessionCookie(reply, deps);
      request.auditPatch = {
        action: 'user.logout',
        resourceType: 'session',
        resourceId: request.cloud.sessionId,
      };
      return reply.code(204).send();
    });

    app.get('/auth/me', async (request, reply) => {
      if (!request.cloud.user) throw new Unauthorized();
      const memberships = await repos.memberships.listForUser(request.cloud.user.id);
      const orgs = await repos.organizations.listForUser(request.cloud.user.id);
      return reply.code(200).send({
        user: {
          id: request.cloud.user.id,
          email: request.cloud.user.email,
          displayName: request.cloud.user.displayName,
        },
        memberships: memberships.map((m) => ({
          organizationId: m.organizationId,
          role: m.role,
        })),
        organizations: orgs.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          role: o.role,
        })),
        tenant: request.cloud.tenant,
      });
    });
  };
}
