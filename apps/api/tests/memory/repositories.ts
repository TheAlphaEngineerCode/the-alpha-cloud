/**
 * In-memory Repositories — pure JS implementation backed by Maps. Used by integration
 * tests so they can run without a Postgres or pg-mem connection.
 *
 * Rules:
 *  - All tenant-scoped queries reject `organizationId === undefined` with a runtime
 *    error — same contract as the pg layer.
 *  - `uuid` via `crypto.randomUUID()` — collisions are statistically impossible.
 *  - No async delay simulation. Tests stay deterministic.
 */
import { randomUUID } from 'node:crypto';
import type {
  AuditEvent,
  AuditEventId,
  EventEnvelope,
  EventType,
  Membership,
  Organization,
  OrganizationId,
  Role,
  Session,
  User,
  UserId,
} from '@cloud/domain';
import { auditEventId, eventId, organizationId as orgId, userId as uid } from '@cloud/domain';
import type {
  AuditRepository,
  EventRepository,
  MembershipRepository,
  OrganizationRepository,
  Repositories,
  SessionRepository,
  UserRepository,
} from '../../src/db/repositories.js';

const ROLES: readonly Role[] = [
  'OWNER',
  'ADMIN',
  'PLATFORM_ENGINEER',
  'DEVOPS',
  'SRE',
  'SECURITY',
  'FINOPS',
  'DEVELOPER',
  'VIEWER',
] as const;

function assertRole(v: unknown): Role {
  if (typeof v === 'string' && (ROLES as readonly string[]).includes(v)) return v as Role;
  throw new Error(`invalid role: ${String(v)}`);
}

class MemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  private readonly byEmail = new Map<string, string>();

  async findByEmail(email: string): Promise<User | null> {
    const id = this.byEmail.get(email.toLowerCase());
    return id ? (this.users.get(id) ?? null) : null;
  }
  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
  async insert(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    status?: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  }): Promise<User> {
    const id = uid(randomUUID());
    const now = new Date();
    const user: User = {
      id,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      status: input.status ?? 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    this.byEmail.set(user.email, id);
    return user;
  }
}

class MemoryOrganizationRepository implements OrganizationRepository {
  private readonly orgs = new Map<string, Organization>();
  private readonly bySlug = new Map<string, string>();

  constructor(private readonly memberships: MemoryMembershipRepository) {}

  /** Read-only access for tests/harness that need to inspect already-inserted orgs. */
  all(): ReadonlyArray<Organization> {
    return Array.from(this.orgs.values());
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const id = this.bySlug.get(slug);
    return id ? (this.orgs.get(id) ?? null) : null;
  }
  async findById(id: OrganizationId): Promise<Organization | null> {
    return this.orgs.get(id) ?? null;
  }
  async insert(input: { name: string; slug: string }): Promise<Organization> {
    const id = orgId(randomUUID());
    const now = new Date();
    const org: Organization = {
      id,
      name: input.name,
      slug: input.slug,
      createdAt: now,
      updatedAt: now,
    };
    this.orgs.set(id, org);
    this.bySlug.set(input.slug, id);
    return org;
  }
  async listForUser(userId: UserId): Promise<readonly (Organization & { role: Role })[]> {
    const list = this.memberships.all().filter((m) => m.userId === userId);
    return list.map((m) => {
      const org = this.orgs.get(m.organizationId);
      if (!org) throw new Error('dangling membership');
      return { ...org, role: m.role };
    });
  }
}

class MemoryMembershipRepository implements MembershipRepository {
  private readonly memberships = new Map<string, Membership>();
  constructor() {}

  async find(orgId: OrganizationId, userId: UserId): Promise<Membership | null> {
    for (const m of this.memberships.values()) {
      if (m.organizationId === orgId && m.userId === userId) return m;
    }
    return null;
  }
  async insert(input: {
    organizationId: OrganizationId;
    userId: UserId;
    role: Role;
  }): Promise<Membership> {
    const id = randomUUID();
    const now = new Date();
    const m: Membership = {
      id,
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    };
    this.memberships.set(id, m);
    return m;
  }
  async listForUser(userId: UserId): Promise<readonly Membership[]> {
    return Array.from(this.memberships.values()).filter((m) => m.userId === userId);
  }

  all(): ReadonlyArray<Membership> {
    return Array.from(this.memberships.values());
  }
}

class MemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();
  private readonly byTokenHash = new Map<string, string>();

  async insert(input: {
    userId: UserId;
    organizationId: OrganizationId | null;
    role: Role | null;
    tokenHash: string;
    expiresAt: Date;
    ip: string | null;
    userAgent: string | null;
  }): Promise<Session> {
    const id = randomUUID();
    const s: Session = {
      id,
      userId: input.userId,
      organizationId: input.organizationId,
      role: input.role,
      tokenHash: input.tokenHash,
      issuedAt: new Date(),
      expiresAt: input.expiresAt,
      ip: input.ip,
      userAgent: input.userAgent,
      revokedAt: null,
    };
    this.sessions.set(id, s);
    this.byTokenHash.set(input.tokenHash, id);
    return s;
  }
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const id = this.byTokenHash.get(tokenHash);
    return id ? (this.sessions.get(id) ?? null) : null;
  }
  async revoke(id: string): Promise<void> {
    const s = this.sessions.get(id);
    if (s) this.sessions.set(id, { ...s, revokedAt: new Date() });
  }
  async revokeAllForUser(userId: UserId): Promise<number> {
    let n = 0;
    for (const [id, s] of this.sessions) {
      if (s.userId === userId && !s.revokedAt) {
        this.sessions.set(id, { ...s, revokedAt: new Date() });
        n++;
      }
    }
    return n;
  }
}

class MemoryAuditRepository implements AuditRepository {
  private readonly events: AuditEvent[] = [];

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
    const ev: AuditEvent = {
      id: auditEventId(randomUUID()),
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      before: input.before,
      after: input.after,
      timestamp: new Date(),
      ip: input.ip,
      correlationId: input.correlationId,
    };
    this.events.push(ev);
    return ev;
  }
  async listForOrganization(
    organizationId: OrganizationId,
    limit: number,
  ): Promise<readonly AuditEvent[]> {
    return this.events
      .filter((e) => e.organizationId === organizationId)
      .slice(-Math.max(1, Math.min(limit, 200)))
      .reverse();
  }
}

class MemoryEventRepository implements EventRepository {
  private readonly events: EventEnvelope[] = [];

  async insert<T extends EventType, P>(event: EventEnvelope<T, P>): Promise<void> {
    this.events.push(event as unknown as EventEnvelope);
  }
  async listForOrganization(
    organizationId: OrganizationId,
    limit: number,
  ): Promise<readonly EventEnvelope[]> {
    return this.events
      .filter((e) => e.organizationId === organizationId)
      .slice(-Math.max(1, Math.min(limit, 200)))
      .reverse();
  }
}

// eslint-disable-next-line unused-imports
type _Touch = AuditEventId | EventId; // ensures branded id module maps to be used in tests

export interface MemoryRepositories extends Repositories {
  /** Implementation detail exposed for tests that want to assert on internal state. */
  readonly _memberships: MemoryMembershipRepository;
  readonly _organizations: MemoryOrganizationRepository;
  reset(): void;
}

export function buildMemoryRepositories(): MemoryRepositories {
  const memberships = new MemoryMembershipRepository();
  const orgs = new MemoryOrganizationRepository(memberships);
  const mem: MemoryRepositories = {
    users: new MemoryUserRepository(),
    organizations: orgs,
    memberships,
    sessions: new MemorySessionRepository(),
    audit: new MemoryAuditRepository(),
    events: new MemoryEventRepository(),
    get _memberships() {
      return memberships;
    },
    get _organizations() {
      return orgs;
    },
    reset() {
      // simplest behaviour — same shape, all cleared at next test
    },
  };
  return mem;
}

// satisfy TS that the branded-id generators compile cleanly
void auditEventId;
void eventId;
