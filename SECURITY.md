# Security policy

The Alpha Cloud is an infrastructure control plane — a privileged operator surface. The
security model is built around the assumption that **a compromised operator
account or a malicious connector should not be able to silently mutate or
exfiltrate another tenant's infrastructure**.

## Supported versions

Phase 0–1 is pre-alpha. Security fixes land in `main` immediately. There is no
backport policy yet — once a `1.0` line exists, this section will pin it.

## Threat surface today

| Asset | Today's protection |
| --- | --- |
| Password hashes | argon2id (m=19456 KiB, t=2, p=1) — see `@cloud/auth` |
| Session tokens | 32-byte opaque random; stored as SHA-256 hash; cookie is httpOnly + SameSite=lax + secure in production |
| Cookies | `@fastify/cookie` (signed by default disabled; rely on TLS + httpOnly) |
| CSRF | SameSite=lax + SameSite-aware state mutation on POST. Strict-mode CSRF token to be added when the operator console introduces cross-origin actions (Phase 4) |
| CORS | Allow-list via `CORS_ORIGINS` env (`apps/web` only) |
| Rate limiting | Auth bucket 5× tighter than general bucket via `@fastify/rate-limit` |
| Tenant isolation | Every tenant-scoped row has `organization_id NOT NULL` + index; repository layer rejects queries missing a tenant predicate; tenant middleware reads from session, never from request body |
| Authorization | RBAC at route boundary (`requirePermission`, `requireAdmin`, `requireOwner`); unknown role = fail closed |
| Audit | Every mutating request writes an append-only `audit_events` row, including for 4xx/5xx responses |
| Input validation | Zod at the request boundary; domain-level invariants are TS-brand-enforced where they cost zero runtime |
| Headers | Helmet in production (`X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` via `strict-transport-security` once on TLS) |
| Secrets in env | `.env.example` only; `.env` is gitignored. Gitleaks runs in CI |
| Cloud credentials | Not stored by Phase 0–1 (no real connectors yet). When Phase 13 ships, credentials will be encrypted at rest with envelope keys — never plaintext |

## What is NOT implemented yet — and why it's a lie to hide it

These items are declared here so a contributor or auditor never assumes a
protection exists when it doesn't:

- **No TLS termination in-process.** Production deployments must front The Alpha Cloud with
  a TLS-capable reverse proxy or use `secure-cookies` behind a TLS endpoint.
- **No Postgres Row-Level Security (RLS).** Tenant isolation is enforced in
  application code today (ADR-0009). RLS is a hardening step scheduled for
  Phase 14.
- **No password reset / email verification flow.** Phase 1 ships login/register/logout
  only.
- **No SSO / OIDC / GitHub / Google.** Architecture is ready for it; wiring is
  Phase 1.5+ (post-MVP).
- **No MFA enforcement.** `MFA required for administrators` is one of the policy
  examples in spec §33 — implemented once the Policy engine lands (Phase 10).
- **No Incident Response runbook automation.** Spec §36; lands in Phase 12.
- **No IaC sandbox.** Phase 11. Right now IaC inputs to the platform aren't accepted
  at all — so the asset class doesn't exist to protect yet.
- **No OpenTelemetry instrumentation.** Phase 7. Live traces/metrics/logs of the
  platform itself are coming.

## Reporting a vulnerability

While pre-alpha, report directly via GitHub Security Advisories
(`Security` → `Report a vulnerability` on this repo). Please do **not** open a
public issue for security vulnerabilities. Include:

- A description and reproduction (script, request, env).
- Affected versions / commits.
- Severity (CVE-style if possible).

Acknowledgment within 72h, fix ETA within 14 days depending on severity. There
is no bounty program — credit in the changelog if you wish.

## Hardening checklist for self-hosters

- [ ] Set a 32-byte+ random `SESSION_SECRET`.
- [ ] Set `CORS_ORIGINS` to the exact web origin(s).
- [ ] Run behind TLS (`reverse proxy` / `Caddy` / `nginx`).
- [ ] Use a separate Postgres user with `REVOKE UPDATE, DELETE` on `audit_events`.
- [ ] Restrict network egress from the API container; only allow it to reach its
      database, Redis and any cloud provider endpoints the configured connectors
      need (when they exist).
- [ ] Rotate the seed demo user after install (`demo@cloud.test`) or `make db-reset`.

## References

- [`THREAT_MODEL.md`](./THREAT_MODEL.md) — what we protect against.
- [`docs/adr/0009-multi-tenant-architecture.md`](./docs/adr/0009-multi-tenant-architecture.md) — tenant isolation.
- [`docs/adr/0010-human-approved-operations.md`](./docs/adr/0010-human-approved-operations.md) — destructive ops.