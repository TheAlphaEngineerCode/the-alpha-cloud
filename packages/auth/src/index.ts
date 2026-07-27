/**
 * @cloud/auth — password hashing and session token primitives.
 *
 * The hashing algorithm is **argon2id** (OWASP-recommended as of 2024 and beyond). The
 * `@node-rs/argon2` native binding avoids a node-gyp build step on Windows/Linux and works
 * on Node 22 and 24. We use the recommended RFC-9106 parameter set capped to keep latency
 * < 50 ms on dev laptops so login isn't sluggish.
 *
 * Sessions are NOT stored here — this package only knows about tokens / hashes. The session
 * persistence lives in `apps/api/src/auth/sessions.ts` because session storage touches the
 * database and Redis, which the auth lib shouldn't depend on directly.
 */
import { webcrypto } from 'node:crypto';
import { hash, verify, type Options } from '@node-rs/argon2';

/**
 * Argon2id is the default algorithm of `@node-rs/argon2` (RFC 9106 normative default).
 * We don't name the `Algorithm` const-enum here because `isolatedModules` blocks
 * access to ambient const enums; the binary's default is exactly what we want.
 */

/**
 * Tuned for ~25 ms on a modern laptop. Memory is in KiB.
 *
 * - m = 19456 KiB (~19 MB)
 * - t = 2 iterations
 * - p = 1 parallelism (node-rs caps to 1 anyway)
 *
 * Update cautiously — tightening breaks already-issued hashes.
 */
export const ARGON2_OPTIONS: Readonly<Options> = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hash a plaintext password with argon2id. Throws on `undefined`/empty input.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (!plaintext) throw new Error('hashPassword: empty input');
  return hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext attempt against a stored argon2 hash. Returns false (never throws) on
 * mismatch or malformed hash — this is the constant-result contract that callers expect.
 */
export async function verifyPassword(
  storedHash: string,
  attempt: string,
): Promise<boolean> {
  if (!storedHash || !attempt) return false;
  try {
    return await verify(storedHash, attempt);
  } catch {
    // Malformed hash, version mismatch, etc. Caller treats as "not authenticated".
    return false;
  }
}

/**
 * Generate a cryptographically random opaque session token (256 bits) for cookie storage.
 *
 * Returned as base64url with no padding. Callers MUST store `hashToken(token)` in DB and
 * compare incoming cookies by hash, never by raw token.
 */
export function generateSessionToken(): string {
  const buf = new Uint8Array(32);
  webcrypto.getRandomValues(buf);
  return base64url(buf);
}

/**
 * Constant-time-ish hash of the raw token for DB storage. Uses WebCrypto SHA-256 (available
 * in Node 22+). The raw token never persists; only this hash does.
 */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await webcrypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(digest));
}

/** Compare two token hashes in constant time — defence against timing-attack enumeration. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function base64url(bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}