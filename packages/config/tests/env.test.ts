import { describe, it, expect } from 'vitest';
import { buildEnv, envSchema } from '../src/index.js';

const valid = {
  API_PUBLIC_URL: 'http://localhost:8080',
  WEB_PUBLIC_URL: 'http://localhost:3000',
  NEXT_PUBLIC_API_URL: 'http://localhost:8080',
  SESSION_SECRET: 'x'.repeat(64),
  CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001',
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_DB: 'cloud',
  POSTGRES_USER: 'cloud',
  POSTGRES_PASSWORD: 'cloud',
  REDIS_HOST: '127.0.0.1',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_BUCKET: 'cloud',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
} satisfies Record<string, string | undefined>;

describe('env schema', () => {
  it('applies defaults for optional fields', () => {
    const env = buildEnv(valid);
    expect(env.NODE_ENV).toBe('development');
    expect(env.RATE_LIMIT_AUTH_MAX).toBe(10);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('coerces numbers and rejects invalid ports', () => {
    const ok = buildEnv({ ...valid, API_PORT: '9090' });
    expect(ok.API_PORT).toBe(9090);
    expect(() => buildEnv({ ...valid, API_PORT: 'nope' })).toThrow();
  });

  it('rejects missing required variables', () => {
    const r = envSchema.safeParse({ ...valid, POSTGRES_HOST: undefined });
    expect(r.success).toBe(false);
  });
});
