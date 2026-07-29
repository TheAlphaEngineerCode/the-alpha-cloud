import type { EventId, OrganizationId, UserId, AuditEventId } from './ids.js';

/**
 * Event envelope (spec §42). One shape for every domain event. The payload is wide;
 * consumers MUST switch on `type` before accessing it.
 */
export interface EventEnvelope<T extends EventType = EventType, P = unknown> {
  readonly id: EventId;
  readonly type: T;
  readonly version: 1;
  readonly organizationId: OrganizationId;
  readonly source: string;
  readonly entityId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly occurredAt: Date;
  readonly payload: P;
}

export type EventType =
  | 'resource.discovered'
  | 'resource.updated'
  | 'resource.deleted'
  | 'application.created'
  | 'deployment.started'
  | 'deployment.completed'
  | 'deployment.failed'
  | 'deployment.rolled_back'
  | 'drift.detected'
  | 'alert.created'
  | 'alert.resolved'
  | 'security.finding.created'
  | 'cost.updated'
  | 'cost.anomaly.detected'
  | 'incident.created'
  | 'incident.resolved'
  | 'automation.started'
  | 'automation.completed'
  | 'automation.failed'
  | 'user.registered'
  | 'user.login'
  | 'user.logout'
  | 'session.revoked'
  | 'organization.created'
  | 'policy.violation';

/** Strongly-typed envelope constructor — keeps `version` and required fields honest. */
export function buildEvent<T extends EventType, P>(
  partial: Omit<EventEnvelope<T, P>, 'version'>,
): EventEnvelope<T, P> {
  return { version: 1, ...partial };
}

/** Stable event-type registry — drives the bus subscription table. */
export const ALL_EVENT_TYPES: readonly EventType[] = [
  'resource.discovered',
  'resource.updated',
  'resource.deleted',
  'application.created',
  'deployment.started',
  'deployment.completed',
  'deployment.failed',
  'deployment.rolled_back',
  'drift.detected',
  'alert.created',
  'alert.resolved',
  'security.finding.created',
  'cost.updated',
  'cost.anomaly.detected',
  'incident.created',
  'incident.resolved',
  'automation.started',
  'automation.completed',
  'automation.failed',
  'user.registered',
  'user.login',
  'user.logout',
  'session.revoked',
  'organization.created',
  'policy.violation',
] as const;

/** Audit projection — derived from subset of events (spec §39). */
export interface AuditEvent {
  readonly id: AuditEventId;
  readonly organizationId: OrganizationId | null;
  readonly actorId: UserId | null;
  readonly action: string;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly before: unknown;
  readonly after: unknown;
  readonly timestamp: Date;
  readonly ip: string | null;
  readonly correlationId: string;
}
