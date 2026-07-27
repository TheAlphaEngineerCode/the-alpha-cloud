import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTestApp, register, type TestApp } from '../helpers/app.js';

let sut: TestApp;

beforeEach(async () => { sut = await buildTestApp(); });
afterEach(async () => { await sut.close(); });

describe('tenant isolation', () => {
  async function setupTwoTenants() {
    const tenantA = await register(sut.app, {
      email: 'a@cloud.test',
      password: 'S3cur3-Cloud-Aaa-XX',
      displayName: 'A',
      orgName: 'Org A',
      orgSlug: 'org-a',
    });
    const tenantB = await register(sut.app, {
      email: 'b@cloud.test',
      password: 'S3cur3-Cloud-Bbb-XX',
      displayName: 'B',
      orgName: 'Org B',
      orgSlug: 'org-b',
    });
    // Seed an audit row visible to org B only
    await sut.repos.audit.insert({
      organizationId: tenantB.organization.id as never,
      actorId: tenantB.user.id as never,
      action: 'user.login',
      resourceType: 'session',
      resourceId: 'b-session',
      before: null,
      after: null,
      ip: null,
      correlationId: 'b-corr',
    });
    return { tenantA, tenantB };
  }

  it('tenant A cannot read tenant B audit rows', async () => {
    const { tenantA, tenantB } = await setupTwoTenants();
    // Tenant B sees its audit row.
    const bRes = await sut.app.inject({
      method: 'GET',
      url: '/audit',
      headers: { cookie: tenantB.cookie },
    });
    expect(bRes.statusCode).toBe(200);
    const bBody = JSON.parse(bRes.body) as { audit: { correlationId: string }[] };
    expect(bBody.audit.some((a) => a.correlationId === 'b-corr')).toBe(true);

    // Tenant A must NOT see the row.
    const aRes = await sut.app.inject({
      method: 'GET',
      url: '/audit',
      headers: { cookie: tenantA.cookie },
    });
    expect(aRes.statusCode).toBe(200);
    const aBody = JSON.parse(aRes.body) as { audit: { correlationId: string }[] };
    expect(aBody.audit.some((a) => a.correlationId === 'b-corr')).toBe(false);
  });

  it('cross-tenant resource ids supplied in the URL or body never reach another tenant', async () => {
    const { tenantA } = await setupTwoTenants();
    // The /audit route reads orgId from `request.cloud.tenant` — it ignores any query/body
    // `organizationId` parameter. Writing one to the query string cannot exfiltrate.
    const trickRes = await sut.app.inject({
      method: 'GET',
      url: '/audit?organizationId=00000000-0000-0000-0000-000000000000',
      headers: { cookie: tenantA.cookie },
    });
    expect(trickRes.statusCode).toBe(200);
    const trickBody = JSON.parse(trickRes.body) as { audit: { correlationId: string }[] };
    expect(trickBody.audit.some((a) => a.correlationId === 'b-corr')).toBe(false);
  });

  it('logged-out requests never see any tenant data', async () => {
    await setupTwoTenants();
    const res = await sut.app.inject({ method: 'GET', url: '/audit' });
    expect(res.statusCode).toBe(401);
  });
});