/**
 * Repositories — the only DAO layer the rest of `apps/api` is allowed to call.
 *
 * Why an interface: tests want to substitute the in-memory implementation in
 * `tests/memory/repositories.ts` while production wires ` PgRepositories`
 * against the typed pool. The(rbac + auth + tenant middleware depend on this shape.
 *
 * Every tenant-scoped lookup MUST receive `organizationId` — routers do not invent it
 * from a header. The repository rejects an undefined tenant input with a runtime check
 * that fails loudly in tests (ADR-0009 — tenant scoping is enforced by code, not memory).
 */
import type {
  Organization,
  OrganizationId,
  Session,
  User,
  UserId,
  Role,
  Membership,
  AuditEvent,
  AuditEventId,
  EventEnvelope,
  EventType,
  EventId,
} from '@cloud/domain';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: UserId): Promise<User | null>;
  insert(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    status?: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  }): Promise<User>;
}

export interface OrganizationRepository {
  findBySlug(slug: string): Promise<Organization | null>;
  findById(id: OrganizationId): Promise<Organization | null>;
  insert(input: { name: string; slug: string }): Promise<Organization>;
  listForUser(userId: UserId): Promise<readonly (Organization & { role: Role })[]>;
}

export interface MembershipRepository {
  find(organizationId: OrganizationId, userId: UserId): Promise<Membership | null>;
  insert(input: {
    organizationId: OrganizationId;
    userId: UserId;
    role: Role;
  }): Promise<Membership>;
  listForUser(userId: UserId): Promise<readonly Membership[]>;
}

export interface SessionRepository {
  insert(input: {
    userId: UserId;
    organizationId: OrganizationId | null;
    role: Role | null;
    tokenHash: string;
    expiresAt: Date;
    ip: string | null;
    userAgent: string | null;
  }): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  revoke(id: string): Promise<void>;
  /** Revoke every active session for a user (e.g. on password reset). */
  revokeAllForUser(userId: UserId): Promise<number>;
}

export interface AuditRepository {
  insert(input: {
    organizationId: OrganizationId | null;
    actorId: UserId | null;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    before: unknown;
    after: unknown;
    ip: string | null;
    correlationId: string;
  }): Promise<AuditEvent>;
  listForOrganization(
    organizationId: OrganizationId,
    limit: number,
  ): Promise<readonly AuditEvent[]>;
}

export interface EventRepository {
  insert<T extends EventType, P>(event: EventEnvelope<T, P>): Promise<void>;
  listForOrganization(
    organizationId: OrganizationId,
    limit: number,
  ): Promise<readonly EventEnvelope[]>;
}

export interface Repositories {
  users: UserRepository;
  organizations: OrganizationRepository;
  memberships: MembershipRepository;
  sessions: SessionRepository;
  audit: AuditRepository;
  events: EventRepository;
}

/** Re-export the audit id helpers for callers */
export type { AuditEventId, EventId };
