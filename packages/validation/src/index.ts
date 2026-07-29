/**
 * @cloud/validation — shared Zod schemas + helpers for normalising user input.
 *
 * Schemas here validate the API boundary: request bodies, query strings and CLI flags.
 * Domain invariants (e.g. "every resource has an orgId") live in `@cloud/domain`.
 */
import { z } from 'zod';

/** Email validator that is intentionally conservative (RFC 5321-ish, no exotic quoting). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i, 'invalid email');

/** Display name — non-empty, printable, length 1..100. */
export const displayNameSchema = z.string().trim().min(1, 'required').max(100, 'too long');

/** Password rules. Stored as argon2 hash, never plaintext — see @cloud/auth. */
export const passwordSchema = z
  .string()
  .min(12, 'password must be at least 12 characters')
  .max(1024, 'password is too long')
  .refine((s) => /\d/.test(s), 'password must contain a digit')
  .refine((s) => /[a-z]/.test(s), 'password must contain a lowercase letter')
  .refine((s) => /[A-Z]/.test(s), 'password must contain an uppercase letter');

/** RFC 4122 UUID v4. */
export const uuidSchema = z.string().uuid('must be a valid UUID');

/** Slug — for organization handles, project keys. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9-]+[a-z0-9]$/, 'must be lowercase letters, digits and hyphens');

/** ISO-8601 with timezone (we store UTC, but accept anything Zod parses). */
export const timestampSchema = z.string().datetime({ offset: true });

/** Sanitize a free-text input: trim, collapse internal whitespace, cap length. */
export function sanitizeText(input: string, max = 4096): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, max);
}

import { webcrypto } from 'node:crypto';

/** CUID-style random id for non-conflicting correlated fields (correlationId, causationId). */
export function randomId(prefix = ''): string {
  const buf = new Uint8Array(16);
  webcrypto.getRandomValues(buf);
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix.length > 0 ? `${prefix}_${hex}` : hex;
}

export { z } from 'zod';
