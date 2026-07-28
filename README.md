<div align="center">

# The Alpha Cloud

**A cloud infrastructure control plane — not another dashboard.**

It discovers infrastructure, builds a topology graph that powers blast-radius analysis,
provisions environments, executes deployments, observes workloads, controls costs, detects risks,
applies policies and automates operations — and it **audits every mutation it makes**.

[![CI](https://github.com/TheAlphaEngineerCode/the-alpha-cloud/actions/workflows/ci.yml/badge.svg)](https://github.com/TheAlphaEngineerCode/the-alpha-cloud/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](./tsconfig.base.json)
[![Phase](https://img.shields.io/badge/phase-0--1%20of%2014-orange.svg)](./ROADMAP.md)

</div>

---

The one operational question it exists to answer:

> _What is running, where is it running, how much does it cost, what depends on it, what state is
> it in, what risks does it carry, and what happens if something changes or fails?_

---

## Current state — read this before cloning

This repository is in **Phase 0–1** of a 14-phase roadmap (see
[`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) and
[`ROADMAP.md`](./ROADMAP.md)). Right now you can:

- **Register** an organization and an OWNER user.
- **Log in / log out** with email + password (argon2id) and cookie sessions.
- Browse the operator console (`/login`, `/dashboard`) — early scaffold.
- Hit `GET /auth/me`, list your organizations and create a new one.
- Trust RBAC enforcement on every mutating route.
- Trust tenant isolation — every query is row-scoped by `organizationId`.
- Trust audit — every `POST/PATCH/PUT/DELETE` writes an append-only audit row.

Topology, deployments, Kubernetes, observability, FinOps, security, IaC and
automation are not implemented yet. There is no real cloud connector; the
[`simulator`](docs/adr/0008-cloud-simulator.md) connector is part of Phase 2.

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Monorepo | pnpm 9 + Turborepo | Workspace, task caching |
| Language | TypeScript 5.9 strict | One type system end-to-end |
| API | Fastify 5 | HTTP/SSE entrypoint, auth, tenant guard, audit |
| Web | Next.js 15 (App Router) | Operator console |
| DB | PostgreSQL 17 | System of record (tenant-scoped rows) |
| Cache / queue | Redis 7 | Sessions, rate-limit counters, SSE cursors |
| Object storage | MinIO / S3 | IaC plans, SBOMs, raw log archives |
| Auth | argon2id + opaque cookie sessions | Local-first; OIDC later |
| Observability | OpenTelemetry + Prometheus + Loki + Tempo | Self + tenant (Phase 7+) |
| IaC engine | OpenTofu in a sandboxed container | Never on host |
| Tests | Vitest | Unit, integration, RBAC, tenant isolation |

See [`docs/adr/`](./docs/adr) for every architectural decision and the trade-off
that produced it.

## Quick start

```bash
git clone https://github.com/TheAlphaEngineerCode/the-alpha-cloud
cd the-alpha-cloud
cp .env.example .env
make setup         # pnpm install
make docker-up     # Postgres 17 + Redis 7 + MinIO + OTel collector
make db-migrate    # apply schema migrations
make db-seed       # seed demo org + user
make dev           # web on :3000, api on :8080
```

Demo credentials after `make db-seed`:

```
email:    demo@cloud.test
password: Cloud-Demo-12345!
```

Open `http://localhost:3000`, sign in, and you should see the dashboard with the
seeded organization (`Alpha Cloud Labs`).

Without Docker? `apps/api` works against an external `DATABASE_URL` — point
`.env` at your existing Postgres and skip `docker-up`.

## Repository layout

```text
the-alpha-cloud/
├── apps/
│   ├── web/         Next.js operator console
│   ├── api/         Fastify HTTP/SSE API
│   ├── worker/      background event subscribers
│   ├── cli/         `cloud` CLI
│   └── docs/        docs site scaffold (Phase 2+)
├── packages/        cross-cutting libs (domain, auth, perms, events, logger…)
├── services/        per-domain logic (Phase 2+)
├── connectors/      CloudProvider implementations (Phase 2+)
├── infrastructure/  Docker / Kubernetes / Helm / OpenTofu
├── docs/            ADRs, architecture diagrams, domain definitions
└── .github/         CI workflows, dependabot
```

## Security posture

- Argon2id password hashing (RFC 9106 normative default).
- Opaque session tokens stored as SHA-256 hash in Postgres — raw token never persists.
- Per-tenant row scoping on every tenant-scoped query.
- Audit row written for every mutating request, including failures.
- RBAC enforcement at the route boundary; unknown role = fail closed.
- CORS allow-list, structured rate limiting (auth bucket tighter than general).
- Helmet in production; strict input validation via Zod.
- IaC execution sandboxed; never on host (ADR-0007).
- Threat model in [`THREAT_MODEL.md`](./THREAT_MODEL.md).

Unimplemented controls are listed explicitly in `THREAT_MODEL.md` so a
contributor never assumes a control exists when it does not.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Brief version:

- Conventional Commits, signed commits welcome.
- Every PR must pass lint, typecheck, the test suite (incl. tenant isolation).
- New `DESTRUCTIVE` actions require an approval path (ADR-0010).
- No co-author attribution to AI agents (by repo convention).

## Where to read next

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — design at a glance.
- [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) — live progress.
- [`ROADMAP.md`](./ROADMAP.md) — 14 phases.
- [`THREAT_MODEL.md`](./THREAT_MODEL.md) — what we protect against and what isn't yet.
- [`docs/adr/`](./docs/adr) — every architectural decision recorded.

## License

Apache License 2.0. See [`LICENSE`](./LICENSE).
