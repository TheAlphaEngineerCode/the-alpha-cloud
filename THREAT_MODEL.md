# Threat model

The Alpha Cloud is privileged software — it can mutate real infrastructure. The model
identifies the actors who interact with it, the assets worth protecting, the
adversaries we expect, and the controls that exist (or are scheduled) for each
threat. Items marked **`(planned)`** are not implemented in Phase 0–1.

## Actors

| Actor | Trust | Surface |
| --- | --- | --- |
| **Authenticated user** | low-trust | Reads and writes via API + web. RBAC bounds what they can do. |
| **Platform admin (OWNER/ADMIN)** | medium-trust | Same surface, plus organization administration. |
| **Self-hoster operator** | full on host, low on tenant data | Deploys The Alpha Cloud, holds secrets, configures connectors. |
| **Connector (e.g. AWS SDK)** | zero-trust | External party code that produces the data The Alpha Cloud ingests. |
| **Anonymous internet** | zero-trust | Public network to the API. |

## Assets

| Asset | Why it matters |
| --- | --- |
| Cloud credentials | Their theft = full control of the tenant's cloud. |
| Secrets stored as `secrets references` | The platform stores pointers; losing them mutates prod env config silently. |
| Tenant data (resource inventory, costs, audit) | Visibility into production shape = attack surface for adversarial recon. |
| IaC state | Unauthorized change = silent infra drift or sabotage. |
| Session tokens | Their theft = impersonation of the operator. |
| Audit log | Lose it and you lose forensic value of every action. |
| Worker process | Commands run there; compromise = arbitrary code on the host, possibly cross-tenant data access. |

## Adversaries

1. **Credential thief** — wants cloud creds or session tokens.
2. **Privilege escalator** — a `VIEWER` who tries to execute `admin.users` or
   another tenant's `resource.read`.
3. **Tenant escaper** — adversarial tenant who wants to read other tenants'
   data through aide-jumps (`organizationId` swapped in body, query string, etc).
4. **Malicious IaC author** — third-party module that contains a hidden `eval`
   or a side-effect that exfiltrates or destroys.
5. **Compromised cloud provider** — e.g. a credential leak upstream the chain.
6. **Webhook spoofer** — claims to be a provider event the platform trusts.
7. **Supply-chain attacker** — a malicious dependency, container image, SBOM
   merger, or one-time `pnpm install` from a poisoned registry.
8. **Insider operator** — owns host access. The platform cannot fully protect
   against this case but must leave a clean audit trail.

## Threat / control matrix

| Threat | Likelihood | Impact | Control today | Control next |
| --- | --- | --- | --- | --- |
| Credential theft | medium | critical | Cloud creds not stored yet (Phase 0–1) | Phase 13: envelope encryption, per-tenant KMS, optional Vault |
| Privilege escalation | high | critical | RBAC fail-closed by default; unknown role = no perms; per-route `requirePermission` decorators | Phase 10: policy engine codifies "no admin without MFA" |
| Tenant escape | high | critical | Every tenant-scoped row carries `organization_id NOT NULL`; repository layer rejects queries without tenant predicate; tenant read from session, not body | Phase 14: Postgres RLS as belt-and-suspenders |
| Malicious IaC | high | critical | No IaC execution path exists yet | Phase 11: sandboxed container execution; no host network egress; human approval pre-apply |
| Compromised cloud provider | low | high | n/a yet | Phase 13: deterministic resource diff vs. recorded state; alert on drift |
| Secret leakage via API | medium | high | Logger redacts `password`, `token`, `passwordHash`, `cookie`, `authorization`; secrets api forbids full-read after write **(planned)** | Phase 6: secrets endpoints never return the raw secret |
| Webhook spoofing | medium | high | No webhooks yet | Phase 13: HMAC-signed events per-connector; replay-protection nonce |
| Command injection | medium | critical | IaC binaries run via fixed args; user input never reaches shell at Phase 0–1 | Phase 11: strict argv-based subprocess; allow-list of commands |
| Supply-chain compromise | medium | critical | Dependabot weekly, Renovate deferred, `gitleaks` in CI, type-checks lock downstream types | Phase 14: SBOM generation, Reproducible builds (`pnpm install --frozen-lockfile`), allow-list of registries |
| Worker compromise | low | critical | Worker is no-op Phase 0–1 | Phase 4+: worker reads only Redis + Postgres; no cloud SDKs; egress blocked at network level |
| Audit log tampering | medium | high | `audit_events` row inserted in same tx as mutation; in-memory tests prove inserts | Phase 14: rotate console role that has INSERT; revoke UPDATE/DELETE from app role |
| Session fixation | medium | high | Token is freshly minted 32 random bytes per login/register; cookie is httpOnly + SameSite=lax | Phase 1.5: rotate token on privilege change |
| Enumeration via timing | low | medium | Argon2id verify is constant-time; login failure for unknown user takes the same path as wrong password | Phase 4: add `deliberate delay` for password verification of unknown users |
| Cross-tenant data leakage via logs | medium | high | Logger redacts known-secret fields; structured logs avoid inspecting data | Phase 7: log scrubbing pipeline, tenant CF in collector |
| ReDoS in user-supplied regex (when regex lands) | high if applicable | high | Not yet — no user regex at runtime. ADR-0003 of `alpha-graph-code` lesson | Phase 4+: user-regex elsewhere enforces NFA limit |

## What this file deliberately does NOT claim

- A strength rating. There is no `degree of confidence` here — controls are
  either in code or in `(planned)`.
- Any cloud-provider-specific control. The platform is cloud-agnostic by design
  (ADR-0004); controls normalize via connectors.
- Anti-DNS / anti-BGP coverage. Those are infrastructure concerns up to the
  self-hoster, not the platform's surface.

## Updates

This file is updated every phase in the same commit that lands the controls it
describes. Controls removed are kept in `git` history. New threats are appended
in chronological order.