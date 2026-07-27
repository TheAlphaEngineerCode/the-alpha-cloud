import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTestApp, register, type TestApp } from '../helpers/app.js';

let sut: TestApp;

beforeEach(async () => { sut = await buildTestApp(); });
afterEach(async () => { await sut.close(); });

describe('audit recording', () => {
  it('login writes an audit row', async () => {
    await register(sut.app, {
      email: 'audit@cloud.test',
      password: 'S3cur3-Cloud-Aud-XX',
      displayName: 'Aud',
      orgName: 'Org Aud',
      orgSlug: 'org-aud',
    });
    const auditRows = sut.repos.audit.listForOrganization(
      sut.repos._organizations.all()[0]!.id,
      10,
    );
    // Use sync-friendly counts (listForOrganization is async)
    return auditRows.then((rows) => {
      const actions = rows.map((r) => r.action);
      expect(actions).toContain('user.register');
    });
  });

  it('GET /auth/me is NOT audited (read implies no noise)', async () => {
    const { cookie } = await register(sut.app, {
      email: 'noaudit@cloud.test',
      password: 'S3cur3-Cloud-Na-XX',
      displayName: 'Noa',
      orgName: 'Org Na',
      orgSlug: 'org-na',
    });
    // Warm the GET path
    await sut.app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
    await sut.app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
    const orgId = sut.repos._organizations.all()[0]!.id;
    const rows = await sut.repos.audit.listForOrganization(orgId, 50);
    const actions = rows.map((r) => r.action);
    expect(actions).not.toContain('GET /auth/me');
  });
});