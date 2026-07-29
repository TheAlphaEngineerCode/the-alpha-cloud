/**
 * Fastify application surface — the only thing handlers should need that's pre-bound on
 * `request`/`server`.
 */
import type { OrganizationId, Role, Session, User, UserId } from '@cloud/domain';
import type { EventBus } from '@cloud/events';
import type { Repositories } from '../db/repositories.js';

/**
 * Typed per-request context. Bound by the tenant middleware after session validation.
 *
 * Every tenant-scoped handler reads from `request.tenant` — never from query/body.
 * `tenant === null` means "unauthenticated request" (login/register endpoints).
 */
export interface RequestContext {
  readonly sessionId: string | null;
  readonly user: User | null;
  readonly tenant: {
    readonly organizationId: OrganizationId;
    readonly role: Role;
  } | null;
}

export interface AppDeps {
  readonly repos: Repositories;
  readonly bus: EventBus;
  readonly sessionCookieName: string;
  readonly sessionCookieDomain: string | null;
  readonly sessionCookieSecure: boolean;
  readonly sessionCookieSameSite: 'lax' | 'strict' | 'none';
  readonly sessionTtlSeconds: number;
  /** Origins allowed on actual CORS responses. */
  readonly corsOrigins: readonly string[];
  /** Auth rate-limit thresholds. */
  readonly rateLimitAuthMax: number;
  readonly rateLimitAuthWindowSeconds: number;
  readonly rateLimitGeneralMax: number;
  readonly rateLimitGeneralWindowSeconds: number;
}

export type Authenticatedrequest = {
  readonly cloud: RequestContext;
};

/** Sentinel thrown by the `requireAuth` decorator on missing/invalid session. */
export class Unauthorized extends Error {
  readonly statusCode = 401;
  constructor(msg = 'unauthorized') {
    super(msg);
    this.name = 'Unauthorized';
  }
}

export class Forbidden extends Error {
  readonly statusCode = 403;
  constructor(msg = 'forbidden') {
    super(msg);
    this.name = 'Forbidden';
  }
}

export class BadRequest extends Error {
  readonly statusCode = 400;
  readonly fields?: Readonly<Record<string, string>>;
  constructor(msg: string, fields?: Readonly<Record<string, string>>) {
    super(msg);
    this.name = 'BadRequest';
    this.fields = fields;
  }
}

export class Conflict extends Error {
  readonly statusCode = 409;
  constructor(msg: string) {
    super(msg);
    this.name = 'Conflict';
  }
}

export type { Session, User, UserId, Role, OrganizationId };
