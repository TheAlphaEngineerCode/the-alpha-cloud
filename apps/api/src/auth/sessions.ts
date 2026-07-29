/**
 * Session helpers — cookie parsing, session issuance and revocation.
 *
 * What lives here: shape of the cookie, token→session lookup against the repository,
 * issuance flow on successful login/register.
 *
 * What does NOT live here: password verification (in @cloud/auth), RBAC decisions
 * (in @cloud/permissions), audit row insertion (in audit middleware).
 */
import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { generateSessionToken, hashToken } from '@cloud/auth';
import type { OrganizationId, Role, Session, UserId } from '@cloud/domain';
import type { SessionRepository } from '../db/repositories.js';
import type { AppDeps } from './context.js';

export interface CookieSession {
  token: string;
  session: Session;
}

export async function issueSession(opts: {
  repo: SessionRepository;
  userId: UserId;
  organizationId: OrganizationId | null;
  role: Role | null;
  ttlSeconds: number;
  ip: string | null;
  userAgent: string | null;
}): Promise<CookieSession> {
  const token = generateSessionToken();
  const tokenHash = await hashToken(token);
  const session = await opts.repo.insert({
    userId: opts.userId,
    organizationId: opts.organizationId,
    role: opts.role,
    tokenHash,
    expiresAt: new Date(Date.now() + opts.ttlSeconds * 1000),
    ip: opts.ip,
    userAgent: opts.userAgent,
  });
  return { token, session };
}

export function setSessionCookie(
  reply: FastifyReply,
  deps: Pick<
    AppDeps,
    | 'sessionCookieName'
    | 'sessionTtlSeconds'
    | 'sessionCookieSecure'
    | 'sessionCookieSameSite'
    | 'sessionCookieDomain'
  >,
  token: string,
): void {
  void reply.setCookie(deps.sessionCookieName, token, {
    httpOnly: true,
    secure: deps.sessionCookieSecure,
    sameSite: deps.sessionCookieSameSite,
    path: '/',
    maxAge: deps.sessionTtlSeconds,
    domain: deps.sessionCookieDomain ?? undefined,
  });
}

export function clearSessionCookie(
  reply: FastifyReply,
  deps: Pick<AppDeps, 'sessionCookieName'>,
): void {
  void reply.clearCookie(deps.sessionCookieName, { path: '/' });
}

export function readSessionToken(
  request: FastifyRequest,
  deps: Pick<AppDeps, 'sessionCookieName'>,
): string | null {
  const raw = request.cookies?.[deps.sessionCookieName];
  if (!raw) return null;
  return raw;
}

export interface CorrelationContext {
  correlationId: string;
  ip: string | null;
}

export function correlationFromRequest(request: FastifyRequest): CorrelationContext {
  const header = request.headers['x-correlation-id'] ?? request.headers['x-request-id'];
  const id = typeof header === 'string' && header.length > 0 ? header : randomUUID();
  const ip = request.ip === '::1' || request.ip === 'unknown' ? null : request.ip;
  return { correlationId: id, ip };
}
