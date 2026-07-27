# Implementation status

> Living document. Updated at every commit so that any agent who reads this and
> then is instructed `Continue development` knows exactly where to resume.

## Current phase

**Phase 0 + Phase 1** are complete. Plan moves to **Phase 2 — Cloud Inventory**.

The repo runs on the lowest engine node declared (`Node 22.13`); the local dev
machine is Node 24, which is the highest matrix cell exercised by CI.

## What works today (Phase 0–1)

### Monorepo foundation
- pnpm 9 workspaces + Turborepo 2.5 with strict task boundaries.
- TypeScript 5.9.3 strict across every package (`tsconfig.base.json`).
- ESLint typed (`eslint.config.js`), Prettier, Vitest configured per-package.
- Per-package `package.json` + `tsconfig.json` extending the base config.
- Apps: `web`, `api`, `worker`, `cli`, `docs`.
- Shared packages: `domain`, `database`, `auth`, `permissions`, `events`,
  `config`, `logger`, `telemetry`, `validation`, `api-client`, `ui`,
  `policies`, `sdk`.

### Infrastructure
- `docker-compose.yml` boots Postgres 17, Redis 7, MinIO, OTel collector.
- `.env.example` documents every env var the platform depends on.
- `Makefile` exposes `setup / dev / test / lint / typecheck / build / docker-up
  / docker-down / db-migrate / db-seed / db-reset / security / clean`.

### Auth (Phase 1)
- `POST /auth/register` — atomic create of user + org + OWNER membership + session.
- `POST /auth/login` — argon2id verify (constant-time for wrong user vs wrong
  password), session bound to first membership, cookie set.
- `POST /auth/logout` — revokes session row, clears cookie.
- `GET /auth/me` — current user + memberships + organizations + active tenant.
- `POST /organizations` — create new org, makes current user OWNER.
- `GET /organizations` — list memberships for current user.
- Cookie: `httpOnly`, `secure` in production, `SameSite=lax`, name configurable.

### RBAC + tenant isolation + audit
- Tenant middleware resolves `request.cloud.tenant` from the session org; an
  unauthenticated request has `cloud.tenant === null`. Tenant-scoped endpoints
  read from `request.cloud.tenant` only — never from body/query.
- Per-route permission decorators (`requireAuth`, `requirePermission`,
  `requireAdmin`, `requireOwner`); unknown role fails closed.
- Permission matrix declared in `@cloud/permissions`; tests assert no role grants
  a permission not declared.
- `auditPreHandler` (async) sets a default `auditPatch` for mutating verbs;
  handlers overwrite it with action + resourceType + resourceId + optional
  `organizationId` (used when register creates a new tenant mid-request).
- `auditOnSend` (async) writes the row. Reads of `GET/HEAD/OPTIONS` are not
  audited (noise reduction).

### Web
- Next.js 15 App Router. Routes: `/`, `/login`, `/dashboard`.
- Login form fetches `/auth/login` or `/auth/register` and routes to `/dashboard`.
- Dashboard fetches `/auth/me` and renders organizations; redirects to login
  on 401.
- `next.config.ts` exposes `NEXT_PUBLIC_API_URL`.

### CLI
- `cloud help` / `cloud version` / `cloud doctor` ship.
- Remaining commands are placeholders referencing this file.

### Worker
- Subscribes to every event type; logs at debug level. Waits for SIGTERM/SIGINT.

### CI
- GitHub Actions: install (matrix Node 22 + 24), lint, typecheck, unit tests
  (matrix), build, secret scan (gitleaks), CodeQL.

## What's pending / known issues

### Pending (Phase 2)
- `CloudProvider` interface implementation + local + simulator connectors.
- Resource discovery sweep + inventory dashboard + blast-radius preview.
- Real `pg` integration tests against `pg-mem` (snapshot) — current tests are
  in-memory repo based.

### Known issues / technical debt
- No real Postgres integration tests; `pg-mem` path **not wired** yet. The
  schema ran against an actual `postgres:17` container during hand-testing
  (verified locally), but the automated suite is unit-only. Phase 2 task.
- Health probe (`/ready`) issues a dummy `audit.listForOrganization` call with
  an all-zero UUID; that works but is a hack. Replace with a typed `pool.ping()`
  helper in `@cloud/database`.
- `audit_events` write happens in the `onSend` hook — a hook error shouldn't
  break the request, and `console.error` is the fallback. In production this
  should route through the logger and the OTel pipeline (Phase 7).
- Redis + MinIO + OTel are in `docker-compose.yml` but no code reads them yet.
  Redis will hold session cache + rate-limit buckets when extracted from
  in-process memory; MinIO will hold IaC plans and SBOMs; OTel will export
  metrics + traces in Phase 7.
- Cost engine, security engine, drift engine, observability, IaC, automation —
  module packages exist as empty placeholders (`packages/policies`,
  `services/*`).

### Tests
- 20 route + RBAC + tenant isolation + audit tests, all green.
- Coverage thresholds set at 80% globally; the suite reaches them, but a real
  per-package coverage run is part of the Phase 2 setup.
- No `e2e` Playwright yet (Phase 4).

### Architecture decisions
- ADRs 0001–0010 written; new decisions append new files.

## Next steps (Phase 2 starter)

1. Implement `CloudProvider` and the `LocalProvider` + `SimulatorProvider` in
   `connectors/`. The simulator must ship a deterministic `healthy-platform`
   scenario that returns ~25 resources of varied types and an adjacent graph.
2. Migrate per-package `eslint.config.js` env: `vitest/config` doesn't accept
   Node types unless `lib: ['node']` is asserted via root `types: ['node']`.
3. Wire `pg-mem` into `apps/api/tests/integration/` so that the real SQL runs
   against Postgres-compatible in-memory tests — these detect drift between
   in-memory and SQL repository implementations.
4. Add a `tests/invariants.test.ts` for the workspace-contract invariants:
   - `packages/` MUST NOT import from `connectors/`.
   - `packages/domain` MUST NOT import from outside `packages/`.
   - Every tenant-scoped table MUST have `organization_id NOT NULL`.
5. Seed the simulator with the **Black Friday Incident** scenario (spec §56) so
   that the topology view has a cascade to demonstrate from the first day.

## How to resume

When instructed `Continue development` from a fresh session:
1. Read [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) for the architectural frame.
2. Read this file (`IMPLEMENTATION_STATUS.md`) for live status.
3. Read the ADRs named in the next phase's "starter" section.
4. `pnpm install && pnpm test` — confirm baseline.
5. Continue from the bullet above "Next steps" — never restart.