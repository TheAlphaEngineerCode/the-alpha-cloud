import { describe, it, expect } from 'vitest';
import { can, canAll, canAny, isAdmin, permissionsFor, RBAC_MATRIX } from '../src/index.js';
import { ALL_ROLES, type Permission } from '@cloud/domain';

const READS: readonly Permission[] = ['resource.read', 'cost.read', 'audit.read'];
const WRITES: readonly Permission[] = [
  'resource.write',
  'deployment.create',
  'infrastructure.apply',
  'cluster.restart',
  'admin.users',
];

describe('rbac matrix completeness', () => {
  it('RBAC_MATRIX has an entry for every role', () => {
    for (const role of ALL_ROLES) {
      expect(RBAC_MATRIX[role]).toBeDefined();
    }
  });
});

describe('rbac core', () => {
  it('viewer can read but never write', () => {
    expect(can('VIEWER', 'resource.read')).toBe(true);
    expect(can('VIEWER', 'resource.write')).toBe(false);
    expect(can('VIEWER', 'admin.users')).toBe(false);
    for (const w of WRITES) {
      expect(can('VIEWER', w), `${w} must NOT be granted to VIEWER`).toBe(false);
    }
  });

  it('owner is the only role that grants admin.organizations', () => {
    expect(permissionsFor('OWNER').has('admin.organizations')).toBe(true);
    expect(permissionsFor('ADMIN').has('admin.organizations')).toBe(false);
  });

  it('canAll is true only when every permission is granted', () => {
    expect(canAll('PLATFORM_ENGINEER', ['infrastructure.plan', 'infrastructure.apply'])).toBe(true);
    expect(canAll('DEVOPS', ['infrastructure.plan', 'infrastructure.apply'])).toBe(false);
  });

  it('canAny short-circuits to true', () => {
    expect(canAny('SRE', READS)).toBe(true);
    expect(canAny('VIEWER', WRITES)).toBe(false);
  });

  it('null or unknown role fails closed', () => {
    expect(can(null, 'resource.read')).toBe(false);
    expect(can(undefined, 'resource.read')).toBe(false);
    expect(can('bogus_role' as never, 'resource.read')).toBe(false);
  });

  it('isAdmin covers OWNER and ADMIN only', () => {
    expect(isAdmin('OWNER')).toBe(true);
    expect(isAdmin('ADMIN')).toBe(true);
    expect(isAdmin('PLATFORM_ENGINEER')).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe('rbac', () => {
  it('viewer can read but never write', () => {
    expect(can('VIEWER', 'resource.read')).toBe(true);
    expect(can('VIEWER', 'resource.write')).toBe(false);
    expect(can('VIEWER', 'admin.users')).toBe(false);
    for (const w of WRITES) {
      expect(can('VIEWER', w), `${w} must NOT be granted to VIEWER`).toBe(false);
    }
  });

  it('owner is the only role that grants admin.organizations', () => {
    const roles: Role[] = ['OWNER', 'ADMIN'];
    for (const r of roles) {
      const perms = permissionsFor(r);
      if (r === 'OWNER') expect(perms.has('admin.organizations')).toBe(true);
      else expect(perms.has('admin.organizations')).toBe(false);
    }
  });

  it('canAll is true only when every permission is granted', () => {
    expect(canAll('PLATFORM_ENGINEER', ['infrastructure.plan', 'infrastructure.apply'])).toBe(true);
    expect(canAll('DEVOPS', ['infrastructure.plan', 'infrastructure.apply'])).toBe(false);
  });

  it('canAny short-circuits to true', () => {
    expect(canAny('SRE', READS)).toBe(true);
    expect(canAny('VIEWER', WRITES)).toBe(false);
  });

  it('null or unknown role fails closed', () => {
    expect(can(null, 'resource.read')).toBe(false);
    expect(can(undefined, 'resource.read')).toBe(false);
    // @ts-expect-error intentional bad input — runtime must fail closed
    expect(can('bogus_role', 'resource.read')).toBe(false);
  });

  it('isAdmin covers OWNER and ADMIN only', () => {
    expect(isAdmin('OWNER')).toBe(true);
    expect(isAdmin('ADMIN')).toBe(true);
    expect(isAdmin('PLATFORM_ENGINEER')).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
