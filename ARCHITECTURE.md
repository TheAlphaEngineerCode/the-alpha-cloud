# Architecture

This document is the living architecture reference for CLOUD. For decision records and
rationale, see [`docs/adr/`](./docs/adr). For the runtime roadmap, see
[`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md).

## Design at a glance

```text
                    ┌───────────────────┐
                    │     CLOUD Web     │
                    │ Next.js / React   │
                    └─────────┬─────────┘
                              │ HTTPS + SSE
                    ┌─────────▼─────────┐
                    │    CLOUD API      │
                    │ TypeScript / Fastify
                    └─────────┬─────────┘
                              │
       ┌──────────────────────┼────────────────────────┐
       │                      │                        │
┌──────▼──────┐      ┌────────▼───────┐      ┌────────▼───────┐
│  Inventory  │      │  Automation    │      │ Observability  │
│  + Topology │      │  Engine        │      │ Engine         │
└──────┬──────┘      └────────┬───────┘      └────────┬───────┘
       │                      │                        │
       └──────────────────────┼────────────────────────┘
                              │ internal bus (Postgres + Redis)
                     ┌────────▼─────────┐
                     │  Event / Job Bus │
                     └────────┬─────────┘
                              │
       ┌──────────────────────┼────────────────────────┐
       │                      │                        │
┌──────▼────┐         ┌────────▼───────┐      ┌────────▼───────┐
│  Cloud    │         │  Kubernetes    │      │   IaC engine   │
│providers  │         │  Connectors    │      │  (OpenTofu,    │
│(aws…sim)  │         │                │      │   sandboxed)   │
└───────────┘         └────────────────┘      └────────────────┘
```

| Layer | Role | Lives in |
| --- | --- | --- |
| Web | Operator console (authed SPA) | `apps/web` |
| API | HTTP/SSE entry, auth, tenant guard, validation, commands | `apps/api` |
| Domain | Pure types, value objects and domain logic — no I/O | `packages/domain` |
| Database | Pool, migrations, typed queries | `apps/api/src/db` + `packages/database` |
| Workers | Discovery, drift, automation, eval — event subscribers | `apps/worker` |
| Connectors | Implementations of `CloudProvider` | `connectors/*` |
| Services | Per-domain logic split into modules | `services/*` |
| Packages | Cross-cutting libs (auth, perms, events, logger, telemetry) | `packages/*` |

## Architectural principles

1. **Modular monolith + workers** (ADR-0001) — explicit module boundaries, one deployable.
2. **Domain is pure** (spec §65) — `packages/domain` imports no Fastify, no Pg, no Redis.
3. **Provider abstraction** (ADR-0004) — vendor SDK never leaks past `connectors/`.
4. **Event-driven core** (ADR-0005) — every state mutation records an event inside the same
   transaction; subscribers are idempotent on `event.id`.
5. **Multi-tenant by row scoping** (ADR-0009) — every tenant-scoped row carries
   `organization_id`; queries without a tenant predicate fail loudly.
6. **Human-approved destructive ops** (ADR-0010) — unknown actions default to `DESTRUCTIVE`
   and require a recorded approval row before execution.

## Pipeline shape

```text
HTTP → middleware (auth, tenant, rate-limit, audit) → command → domain → db (tx)
                                                                      │
                                                                      ├─ emit event (same tx)
                                                                      └─ commit
                                                                                │
                                              subscribers (worker, sse, alerts)●
```

## Datastores

| Store | Purpose | Replaces |
| --- | --- | --- |
| PostgreSQL 17 | Source of truth: resources, edges, accounts, audit, events | — |
| Redis 7 | Sessions, rate-limit counters, SSE cursor map, job queue | — |
| MinIO / S3 | IaC plans, SBOMs, raw log archives | — |
| OpenTelemetry collector | Traces/metrics/logs of the platform itself | — |