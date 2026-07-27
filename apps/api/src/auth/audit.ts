/**
 * Audit helpers — write `audit_events` rows for mutating requests.
 *
 * Reads (GET/HEAD/OPTIONS) are not audited to avoid noise.
 * The handler sets `request.auditPatch` to control the audit record; the onSend
 * hook then writes the row, including for 4xx/5xx responses — failed mutations are
 * worth auditing.
 *
 * Handlers MUST set the patch BEFORE the response is sent; the post-handler hook
 * reads it.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppDeps } from './context.js';
import { correlationFromRequest } from './sessions.js';
import type { Repositories } from '../db/repositories.js';

declare module 'fastify' {
  interface FastifyRequest {
    auditPatch?: {
      action: string;
      resourceType?: string;
      resourceId?: string;
      before?: unknown;
      after?: unknown;
      /**
       * Optional override for the audit row's `organizationId`. Used by handlers
       * that establish a tenant during the request (e.g. `POST /auth/register`)
       * where the tenant middleware ran with no session yet still wants the row
       * to land under the newly-created org.
       */
      organizationId?: string;
    };
    /** Set by `auditPreHandler`. Internal — do not read in handlers. */
    _cloudCorrelation?: string;
    _cloudIp?: string | null;
  }
}

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * preHandler — stashes the correlationId/ip on the request so handlers and the onSend
 * hook have access without re-parsing headers. Sets a default `auditPatch.action` that
 * handlers may overwrite.
 *
 * Note: Fastify 5.x requires preHandler to be either async or use the (req, reply, done)
 * callback form. A synchronous arity-2 function returning `void` will not advance the
 * request lifecycle.
 */
export function auditPreHandler(
  _deps: AppDeps,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, _reply) => {
    if (!MUTATING_METHODS.has(request.method)) return;
    const { correlationId, ip } = correlationFromRequest(request);
    request._cloudCorrelation = correlationId;
    request._cloudIp = ip;
    if (!request.auditPatch) {
      request.auditPatch = { action: `${request.method} ${request.url}` };
    }
  };
}

/**
 * onSend — writes the audit row. Runs for both success and error responses. Failures
 * to write the audit row are logged but never block the response.
 */
export function auditOnSend(
  _deps: AppDeps,
  repos: Repositories,
): (request: FastifyRequest, reply: FastifyReply, payload: unknown) => Promise<unknown> {
  return async (request, _reply, payload) => {
    if (!MUTATING_METHODS.has(request.method)) return payload;
    const patch = request.auditPatch;
    if (!patch) return payload;
    const cloud = request.cloud;
    const correlation = request._cloudCorrelation ?? randomUUID();
    const ip = request._cloudIp ?? null;
    try {
      await repos.audit.insert({
        organizationId: (patch.organizationId as never) ?? cloud?.tenant?.organizationId ?? null,
        actorId: cloud?.user?.id ?? null,
        action: patch.action,
        resourceType: patch.resourceType ?? null,
        resourceId: patch.resourceId ?? null,
        before: patch.before ?? null,
        after: patch.after ?? null,
        ip,
        correlationId: correlation,
      });
    } catch (err) {
      // Audit failure must never block the actual response.
      console.error(
        '[cloud] audit write failed:',
        err instanceof Error ? err.message : err,
      );
    }
    return payload;
  };
}