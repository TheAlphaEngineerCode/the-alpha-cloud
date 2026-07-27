import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTestApp, register, login, type TestApp } from '../helpers/app.js';

let sut: TestApp;

beforeEach(async () => { sut = await buildTestApp(); });
afterEach(async () => { await sut.close(); });

const demoCredentials = {
  email: 'operator@cloud.test',
  password: 'S3cur3-Cloud-Password-IX',
  displayName: 'Demo Operator',
  orgName: 'Alpha Cloud Labs',
  orgSlug: 'alpha-cloud-labs',
};

describe('auth — register', () => {
  it('rejects malformed payload with 400', async () => {
    const res = await sut.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects weak passwords', async () => {
    const res = await sut.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...demoCredentials, password: 'shortpass1' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates a user, organization and OWNER membership, sets a session cookie', async () => {
    const registration = await register(sut.app, demoCredentials);
    expect(registration.cookie.startsWith('cloud_session=')).toBe(true);
    expect(registration.user.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(registration.organization.id).toMatch(/^[0-9a-f-]{36}$/i);

    const membership = sut.repos._memberships.all()[0];
    expect(membership.role).toBe('OWNER');
    expect(membership.userId).toBe(registration.user.id);
  });

  it('rejects duplicate email with 409', async () => {
    await register(sut.app, demoCredentials);
    const res = await sut.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...demoCredentials, orgSlug: 'another-slug' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects duplicate org slug with 409', async () => {
    await register(sut.app, demoCredentials);
    const res = await sut.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        ...demoCredentials,
        email: 'other@cloud.test',
        orgSlug: demoCredentials.orgSlug,
      },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('auth — login', () => {
  it('rejects unknown user with 401 (no leakage of registration state)', async () => {
    const res = await sut.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ghost@cloud.test', password: 'anything-here' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects wrong password with same 401 message as unknown user', async () => {
    await register(sut.app, demoCredentials);
    const known = await sut.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: demoCredentials.email, password: 'wrong-password-XX' },
    });
    const unknown = await sut.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ghost@cloud.test', password: 'wrong-password-XX' },
    });
    expect(known.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(JSON.parse(known.body).message).toBe(JSON.parse(unknown.body).message);
  });

  it('returns a session cookie on success', async () => {
    await register(sut.app, demoCredentials);
    const cookie = await login(sut.app, demoCredentials.email, demoCredentials.password);
    expect(cookie.startsWith('cloud_session=')).toBe(true);
  });
});

describe('auth — me + logout', () => {
  it('returns 401 without a cookie', async () => {
    const res = await sut.app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the user, organizations and active tenant with a cookie', async () => {
    const { cookie } = await register(sut.app, demoCredentials);
    const res = await sut.app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      user: { email: string };
      organizations: { name: string; role: string }[];
      tenant: { role: string };
    };
    expect(body.user.email).toBe(demoCredentials.email);
    expect(body.organizations[0]!.name).toBe(demoCredentials.orgName);
    expect(body.organizations[0]!.role).toBe('OWNER');
    expect(body.tenant!.role).toBe('OWNER');
  });

  it('logout revokes the session', async () => {
    const { cookie } = await register(sut.app, demoCredentials);
    const out = await sut.app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie } });
    expect(out.statusCode).toBe(204);
    // After logout, /auth/me must reject
    const me = await sut.app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });
});