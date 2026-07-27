/**
 * @cloud/permissions — single source of truth mapping roles → permission sets.
 *
 * Rule of thumb: a permission is `READ` unless it materially mutates state. The default
 * role for a new member is `VIEWER` (read-only). Adding a permission to the spec means
 * adding a row here; the RBAC test (`tests/rbac.test.ts`) fails if a role silently grants
 * a permission that's not declared in its row.
 */
import type { Permission, Role } from '@cloud/domain';

type PermSet = ReadonlySet<Permission>;

const ROLES: Readonly<Record<Role, PermSet>> = {
  OWNER: new Set<Permission>([
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
  ]),

  ADMIN: new Set<Permission>([
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
    'admin.providers',
  ]),

  PLATFORM_ENGINEER: new Set<Permission>([
    'resource.read',
    'resource.write',
    'infrastructure.plan',
    'infrastructure.apply',
    'cluster.restart',
    'cluster.scale',
    'policy.read',
    'audit.read',
    'cost.read',
    'security.read',
  ]),

  DEVOPS: new Set<Permission>([
    'resource.read',
    'resource.write',
    'deployment.create',
    'deployment.rollback',
    'infrastructure.plan',
    'cluster.scale',
    'audit.read',
    'cost.read',
  ]),

  SRE: new Set<Permission>([
    'resource.read',
    'security.read',
    'audit.read',
    'cluster.restart',
    'cluster.scale',
    'deployment.rollback',
  ]),

  SECURITY: new Set<Permission>([
    'resource.read',
    'security.read',
    'security.write',
    'policy.read',
    'policy.write',
    'audit.read',
    'cost.read',
  ]),

  FINOPS: new Set<Permission>([
    'resource.read',
    'cost.read',
    'cost.write',
    'policy.read',
    'audit.read',
  ]),

  DEVELOPER: new Set<Permission>([
    'resource.read',
    'deployment.create',
    'cost.read',
  ]),

  VIEWER: new Set<Permission>([
    'resource.read',
    'cost.read',
  ]),
};

/**
 * Main API. Returns true if `role` grants `permission`. Never throws — an unknown role
 * or permission yields false (fail-closed).
 */
export function can(
  role: Role | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  const set = ROLES[role];
  return set ? set.has(permission) : false;
}

/** Returns the entire permission set for a role (for UI affordance hints). */
export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return ROLES[role] ?? new Set<Permission>();
}

/** Returns true iff at least one of `permissions` is granted. */
export function canAny(
  role: Role | null | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((p) => can(role, p));
}

/** Returns true iff all `permissions` are granted. */
export function canAll(
  role: Role | null | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((p) => can(role, p));
}

/**
 * Higher privilege check used for admin-only mutations. Convenience since several
 * endpoints check this exact bundle.
 */
export function isAdmin(role: Role | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export const RBAC_MATRIX: Readonly<Record<Role, ReadonlyArray<Permission>>> = {
  OWNER: Array.from(ROLES.OWNER),
  ADMIN: Array.from(ROLES.ADMIN),
  PLATFORM_ENGINEER: Array.from(ROLES.PLATFORM_ENGINEER),
  DEVOPS: Array.from(ROLES.DEVOPS),
  SRE: Array.from(ROLES.SRE),
  SECURITY: Array.from(ROLES.SECURITY),
  FINOPS: Array.from(ROLES.FINOPS),
  DEVELOPER: Array.from(ROLES.DEVELOPER),
  VIEWER: Array.from(ROLES.VIEWER),
};