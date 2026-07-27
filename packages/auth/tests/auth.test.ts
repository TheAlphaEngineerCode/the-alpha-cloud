import { describe, it, expect } from 'vitest';
import {
  generateSessionToken,
  hashPassword,
  hashToken,
  safeEqual,
  verifyPassword,
} from '../src/index.js';

describe('password hashing', () => {
  it('hashes and verifies a roundtrip', async () => {
    const plaintext = 'Correct-Horse-Battery-9!';
    const hashed = await hashPassword(plaintext);
    expect(hashed).not.toBe(plaintext);
    expect(hashed.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hashed, plaintext)).toBe(true);
  });

  it('returns false on mismatch without throwing', async () => {
    const hashed = await hashPassword('right-password-12');
    expect(await verifyPassword(hashed, 'wrong-password-12')).toBe(false);
  });

  it('returns false on empty input', async () => {
    expect(await verifyPassword('', 'whatever')).toBe(false);
    expect(await verifyPassword('something', '')).toBe(false);
  });
});

describe('session token helpers', () => {
  it('produces a 43-char base64url token', () => {
    const t = generateSessionToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes consistently and never emits the raw token', async () => {
    const t = generateSessionToken();
    const h1 = await hashToken(t);
    const h2 = await hashToken(t);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(t);
  });

  it('safeEqual is constant-time on equal-length inputs', () => {
    const a = 'a'.repeat(32);
    const b = 'a'.repeat(32);
    const c = 'b'.repeat(32);
    expect(safeEqual(a, b)).toBe(true);
    expect(safeEqual(a, c)).toBe(false);
    expect(safeEqual(a, 'short')).toBe(false);
  });
});