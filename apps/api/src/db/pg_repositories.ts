/**
 * Postgres implementations of the Repository interfaces.
 *
 * Every row decoder keeps the same one-line shape — explicit per-column conversion avoids
 * implicit `pg-types` surprises. UUIDs are returned as strings by `pg` by default.
 */
import type { TypedPool } from '@cloud/database';
import { asString, asOptionalString, asDate, asOptionalDate, asNumber } from '@cloud/database';
import type { AuditEventId, EventEnvelope, EventType, OrganizationId, Role, UserId } from '@cloud/domain';
import {
  organizationId as orgId,
  userId as uid,
} from '@cloud/domain';
import type {
  AuditRepository,
  EventRepository,
  MembershipRepository,
  OrganizationRepository,
  Repositories,
  SessionRepository,
  UserRepository,
} from './repositories.js';
import type { User, Organization, Membership, Session, AuditEvent } from '@cloud/domain';

const ROLES: readonly Role[] = [
  'OWNER', 'ADMIN', 'PLATFORM_ENGINEER', 'DEVOPS', 'SRE', 'SECURITY', 'FINOPS', 'DEVELOPER', 'VIEWER',
] as const;

function assertRole(value: unknown): Role {
  if (typeof value === 'string' && (ROLES as readonly string[]).includes(value)) {
    return value as Role;
  }
  throw new Error(`invalid role value: ${String(value)}`);
}

function parseUser(row: Record<string, unknown>): User {
  return {
    id: uid(asString(row.id)),
    email: asString(row.email),
    passwordHash: asString(row.password_hash),
    displayName: asString(row.display_name),
    status: row.status as 'ACTIVE' | 'SUSPENDED' | 'INVITED',
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

function parseOrg(row: Record<string, unknown>): Organization {
  return {
    id: orgId(asString(row.id)),
    name: asString(row.name),
    slug: asString(row.slug),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

function parseMembership(row: Record<string, unknown>): Membership {
  return {
    id: asString(row.id),
    organizationId: orgId(asString(row.organization_id)),
    userId: uid(asString(row.user_id)),
    role: assertRole(row.role),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

function parseSession(row: Record<string, unknown>): Session {
  return {
    id: asString(row.id),
    userId: uid(asString(row.user_id)),
    organizationId: row.organization_id ? orgId(asString(row.organization_id)) : null,
    role: row.role ? assertRole(row.role) : null,
    tokenHash: asString(row.token_hash),
    issuedAt: asDate(row.issued_at),
    expiresAt: asDate(row.expires_at),
    ip: asOptionalString(row.ip),
    userAgent: asOptionalString(row.user_agent),
    revokedAt: asOptionalDate(row.revoked_at),
  };
}

function parseAudit(row: Record<string, unknown>): AuditEvent {
  return {
    id: asString(row.id) as AuditEventId,
    organizationId: row.organization_id ? orgId(asString(row.organization_id)) : null,
    actorId: row.actor_id ? uid(asString(row.actor_id)) : null,
    action: asString(row.action),
    resourceType: asOptionalString(row.resource_type),
    resourceId: asOptionalString(row.resource_id),
    before: row.before_state ?? null,
    after: row.after_state ?? null,
    timestamp: asDate(row.timestamp),
    ip: asOptionalString(row.ip),
    correlationId: asString(row.correlation_id),
  };
}

class PgUserRepository implements UserRepository {
  constructor(private readonly pool: TypedPool) {}
  async findByEmail(email: string): Promise<User | null> {
    return this.pool.queryOne(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()],
      parseUser,
    );
  }
  async findById(id: UserId): Promise<User | null> {
    return this.pool.queryOne('SELECT * FROM users WHERE id = $1', [id], parseUser);
  }
  async insert(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    status?: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  }): Promise<User> {
    const user = await this.pool.queryOne<User>(
      `INSERT INTO users (email, password_hash, display_name, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.email.toLowerCase(), input.passwordHash, input.displayName, input.status ?? 'ACTIVE'],
      parseUser,
    );
    if (!user) throw new Error('user insert returned no rows');
    return user;
  }
}

class PgOrganizationRepository implements OrganizationRepository {
  constructor(private readonly pool: TypedPool) {}
  async findBySlug(slug: string): Promise<Organization | null> {
    return this.pool.queryOne(
      'SELECT * FROM organizations WHERE slug = $1',
      [slug],
      parseOrg,
    );
  }
  async findById(id: OrganizationId): Promise<Organization | null> {
    return this.pool.queryOne('SELECT * FROM organizations WHERE id = $1', [id], parseOrg);
  }
  async insert(input: { name: string; slug: string }): Promise<Organization> {
    const org = await this.pool.queryOne<Organization>(
      'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING *',
      [input.name, input.slug],
      parseOrg,
    );
    if (!org) throw new Error('organization insert returned no rows');
    return org;
  }
  async listForUser(userId: UserId): Promise<readonly (Organization & { role: Role })[]> {
    const rows = await this.pool.query(
      `SELECT o.*, m.role AS role
       FROM organizations o
       JOIN memberships m ON m.organization_id = o.id
       WHERE m.user_id = $1
       ORDER BY o.name`,
      [userId],
      (row) => ({
        ...parseOrg(row),
        role: assertRole(row.role),
      }),
    );
    return rows;
  }
}

class PgMembershipRepository implements MembershipRepository {
  constructor(private readonly pool: TypedPool) {}
  async find(organizationId: OrganizationId, userId: UserId): Promise<Membership | null> {
    return this.pool.queryOne(
      `SELECT * FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId],
      parseMembership,
    );
  }
  async insert(input: {
    organizationId: OrganizationId;
    userId: UserId;
    role: Role;
  }): Promise<Membership> {
    const m = await this.pool.queryOne<Membership>(
      `INSERT INTO memberships (organization_id, user_id, role)
       VALUES ($1, $2, $3) RETURNING *`,
      [input.organizationId, input.userId, input.role],
      parseMembership,
    );
    if (!m) throw new Error('membership insert returned no rows');
    return m;
  }
  async listForUser(userId: UserId): Promise<readonly Membership[]> {
    return this.pool.query(
      'SELECT * FROM memberships WHERE user_id = $1 ORDER BY created_at',
      [userId],
      parseMembership,
    );
  }
}

class PgSessionRepository implements SessionRepository {
  constructor(private readonly pool: TypedPool) {}
  async insert(input: {
    userId: UserId;
    organizationId: OrganizationId | null;
    role: Role | null;
    tokenHash: string;
    expiresAt: Date;
    ip: string | null;
    userAgent: string | null;
  }): Promise<Session> {
    const s = await this.pool.queryOne<Session>(
      `INSERT INTO sessions
         (user_id, organization_id, role, token_hash, expires_at, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.userId,
        input.organizationId,
        input.role,
        input.tokenHash,
        input.expiresAt,
        input.ip,
        input.userAgent,
      ],
      parseSession,
    );
    if (!s) throw new Error('session insert returned no rows');
    return s;
  }
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.pool.queryOne(
      'SELECT * FROM sessions WHERE token_hash = $1',
      [tokenHash],
      parseSession,
    );
  }
  async revoke(id: string): Promise<void> {
    await this.pool.execute(
      'UPDATE sessions SET revoked_at = now() WHERE id = $1',
      [id],
    );
  }
  async revokeAllForUser(userId: UserId): Promise<number> {
    const res = await this.pool.execute(
      'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
    );
    return res.rowCount ?? 0;
  }
}

class PgAuditRepository implements AuditRepository {
  constructor(private readonly pool: TypedPool) {}
  async insert(input: {
    organizationId: OrganizationId | null;
    actorId: UserId | null;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    before: unknown;
    after: unknown;
    ip: string | null;
    correlationId: string;
  }): Promise<AuditEvent> {
    const ev = await this.pool.queryOne<AuditEvent>(
      `INSERT INTO audit_events
         (organization_id, actor_id, action, resource_type, resource_id, before_state, after_state, ip, correlation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        input.organizationId,
        input.actorId,
        input.action,
        input.resourceType,
        input.resourceId,
        JSON.stringify(input.before ?? null),
        JSON.stringify(input.after ?? null),
        input.ip,
        input.correlationId,
      ],
      parseAudit,
    );
    if (!ev) throw new Error('audit insert returned no rows');
    return ev;
  }
  async listForOrganization(organizationId: OrganizationId, limit: number): Promise<readonly AuditEvent[]> {
    return this.pool.query(
      'SELECT * FROM audit_events WHERE organization_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [organizationId, Math.min(limit, 200)],
      parseAudit,
    );
  }
}

class PgEventRepository implements EventRepository {
  constructor(private readonly pool: TypedPool) {}
  async insert<T extends EventType, P>(event: EventEnvelope<T, P>): Promise<void> {
    await this.pool.execute(
      `INSERT INTO events
         (id, organization_id, type, version, source, entity_id, correlation_id, causation_id, occurred_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        event.id,
        event.organizationId,
        event.type,
        event.version,
        event.source,
        event.entityId,
        event.correlationId,
        event.causationId,
        event.occurredAt,
        JSON.stringify(event.payload),
      ],
    );
  }
  async listForOrganization(organizationId: OrganizationId, limit: number): Promise<readonly EventEnvelope[]> {
    return this.pool.query(
      `SELECT * FROM events WHERE organization_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
      [organizationId, Math.min(limit, 200)],
      (row) => ({
        id: asString(row.id) as EventEnvelope['id'],
        type: asString(row.type) as EventEnvelope['type'],
        version: asNumber(row.version) as 1,
        organizationId: orgId(asString(row.organization_id)),
        source: asString(row.source),
        entityId: asString(row.entity_id),
        correlationId: asString(row.correlation_id),
        causationId: asOptionalString(row.causation_id),
        occurredAt: asDate(row.occurred_at),
        payload: row.payload ?? {},
      }),
    );
  }
}

export function buildPgRepositories(pool: TypedPool): Repositories {
  return {
    users: new PgUserRepository(pool),
    organizations: new PgOrganizationRepository(pool),
    memberships: new PgMembershipRepository(pool),
    sessions: new PgSessionRepository(pool),
    audit: new PgAuditRepository(pool),
    events: new PgEventRepository(pool),
  };
}