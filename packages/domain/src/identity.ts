import type {
  ApplicationId,
  ApprovalId,
  AuditEventId,
  DeploymentId,
  EnvironmentId,
  EventId,
  OrganizationId,
  ResourceId,
  SecurityFindingId,
  UserId,
} from './ids.js';

// Touch the imported id brands so re-export is the source of truth rather than
// dead types. `export type` keeps them in the module's surface without reference
// here, but `noUnusedLocals` flags unused imports. The re-export in `index.ts`
// is the public path; this file just provides the data-model types.
export type {
  ApplicationId,
  ApprovalId,
  AuditEventId,
  DeploymentId,
  EnvironmentId,
  EventId,
  ResourceId,
  SecurityFindingId,
};

/** User-facing roles (spec §40). Used as the source of truth that the DB seeds from. */
export type Role =
  | 'OWNER'
  | 'ADMIN'
  | 'PLATFORM_ENGINEER'
  | 'DEVOPS'
  | 'SRE'
  | 'SECURITY'
  | 'FINOPS'
  | 'DEVELOPER'
  | 'VIEWER';

export const ALL_ROLES: readonly Role[] = [
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

/**
 * Granular permission strings. Each role in `packages/permissions` declares which set it
 * grants. Adding a permission requires a code change — stringly-typed permissions are a
 * common source of privilege drift.
 */
export type Permission =
  | 'resource.read'
  | 'resource.write'
  | 'resource.delete'
  | 'deployment.create'
  | 'deployment.rollback'
  | 'infrastructure.plan'
  | 'infrastructure.apply'
  | 'cluster.restart'
  | 'cluster.scale'
  | 'automation.execute'
  | 'security.read'
  | 'security.write'
  | 'cost.read'
  | 'cost.write'
  | 'policy.read'
  | 'policy.write'
  | 'audit.read'
  | 'admin.users'
  | 'admin.organizations'
  | 'admin.providers';

export const ALL_PERMISSIONS: readonly Permission[] = [
  'resource.read',
  'resource.write',
  'resource.delete',
  'deployment.create',
  'deployment.rollback',
  'infrastructure.plan',
  'infrastructure.apply',
  'cluster.restart',
  'cluster.scale',
  'automation.execute',
  'security.read',
  'security.write',
  'cost.read',
  'cost.write',
  'policy.read',
  'policy.write',
  'audit.read',
  'admin.users',
  'admin.organizations',
  'admin.providers',
] as const;

export interface Organization {
  readonly id: OrganizationId;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface User {
  readonly id: UserId;
  readonly email: string;
  /** Argon2 hash; never the plaintext. */
  readonly passwordHash: string;
  readonly displayName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Marks whether the user is allowed to authenticate. */
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
}

/** Membership ties a user to an organization with a role. Tenant boundary is enforced here. */
export interface Membership {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly role: Role;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Session {
  readonly id: string;
  readonly userId: UserId;
  /** Active membership the session is bound to — tenant of the request. */
  readonly organizationId: OrganizationId | null;
  readonly role: Role | null;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  /** Stored as opaque token sent in the cookie; the cookie value equals a hash of this. */
  readonly tokenHash: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly revokedAt: Date | null;
}
