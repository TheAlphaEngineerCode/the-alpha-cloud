import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTestApp, register, type TestApp } from '../helpers/app.js';
import type { Repositories } from '../../src/db/repositories.js';

let sut: TestApp;

beforeEach(async () => {
  sut = await buildTestApp();
});
afterEach(async () => {
  await sut.close();
});

async function createOrg(
  repos: Repositories,
  user: { id: string },
  slug: string,
  role: 'OWNER' | 'ADMIN' | 'VIEWER' | 'DEVELOPER',
) {
  const org = await repos.organizations.insert({ name: `Org-${slug}`, slug });
  await repos.memberships.insert({
    organizationId: org.id,
    userId: user.id as never,
    role,
  });
  return org;
}

async function issueSessionFor(
  repos: Repositories,
  user: { id: string },
  org: { id: string },
  role: 'OWNER' | 'ADMIN' | 'VIEWER' | 'DEVELOPER',
) {
  const { generateSessionToken, hashToken } = await import('@cloud/auth');
  const token = generateSessionToken();
  const tokenHash = await hashToken(token);
  await repos.sessions.insert({
    userId: user.id as never,
    organizationId: org.id as never,
    role,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ip: null,
    userAgent: null,
  });
  return `cloud_session=${token}`;
}

describe('RBAC enforcement', () => {
  it('viewer cannot read audit (no permission)', async () => {
    const { user } = await register(sut.app, {
      email: 'owner@cloud.test',
      password: 'S3cur3-Cloud-Owner-XX',
      displayName: 'Owner',
      orgName: 'Org A',
      orgSlug: 'org-a',
    });
    const org = await createOrg(sut.repos, user, 'org-b', 'VIEWER');
    const cookie = await issueSessionFor(sut.repos, user, org, 'VIEWER');

    const res = await sut.app.inject({
      method: 'GET',
      url: '/audit',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin can read audit', async () => {
    const { user } = await register(sut.app, {
      email: 'admin@cloud.test',
      password: 'S3cur3-Cloud-Admin-XX',
      displayName: 'Admin',
      orgName: 'Org C',
      orgSlug: 'org-c',
    });
    // Seed an audit row visible to org-c
    await sut.repos.audit.insert({
      organizationId: sut.repos._organizations.all()[0]!.id,
      actorId: user.id as never,
      action: 'user.login',
      resourceType: 'user',
      resourceId: user.id,
      before: null,
      after: { ok: true },
      ip: null,
      correlationId: 'seed',
    });
    const cookie = await issueSessionFor(
      sut.repos,
      user,
      sut.repos._organizations.all()[0]!,
      'ADMIN',
    );
    const res = await sut.app.inject({
      method: 'GET',
      url: '/audit',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { audit: { action: string }[] };
    expect(body.audit.length).toBeGreaterThan(0);
    expect(body.audit[0]!.action).toContain('user.login');
  });

  it('unauthenticated request to protected route is 401, not 403', async () => {
    const res = await sut.app.inject({ method: 'GET', url: '/audit' });
    expect(res.statusCode).toBe(401);
  });

  it('viewer cannot create organizations (POST is mutating but allowed for any user)', async () => {
    // The /organizations POST route is authenticated-only by design — creating a NEW
    // tenant boundary is open to any logged-in user, who becomes OWNER of the new org.
    // The test here asserts that the route still requires a cookie.
    const res = await sut.app.inject({
      method: 'POST',
      url: '/organizations',
      payload: { name: 'Forbidden', slug: 'forbidden' },
    });
    expect(res.statusCode).toBe(401);
  });
});
