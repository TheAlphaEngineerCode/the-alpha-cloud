# Cloud — Master Development Prompt (canonical summary)

This file is the canonical summary of the *Cloud Master Development Prompt* that
seeded the project. The full original is in the project history; this summary
captures every architectural decision and serves as the source a fresh agent can
re-read after a `Continue development` instruction.

> For the per-decision rationale, read `docs/adr/`. For the live roadmap with
> per-phase completion status, read `IMPLEMENTATION_STATUS.md` and `ROADMAP.md`.

## Vision

The platform centralizes management, automation and observability of cloud,
containers, Kubernetes and on-prem infrastructure in one operational layer.
Its central question:

> *What is running, where, how much does it cost, what depends on it, what state
> is it in, what risks does it carry, and what happens if something changes or
> fails?*

## Non-goals (declared, not just absent)

- Not another static dashboard.
- Not a fake-data product without signage.
- Not vendor lock-in. No provider SDK in `packages/`.
- Not premature microservices. Modular monolith until evidence forces otherwise.
- Not cloud IaC execution on the host. Always sandboxed.
- Not destructive ops without human approval.
- Not "raise-on-warning" replacing honest documentation.

## Principles

Cloud agnostic · Open source · API first · IaC first · Security by default ·
GitOps friendly · Event driven · Audit everything · Vendor neutral · Multi-tenant
· Modular · Self-hostable · Observable by default · Zero hardcoded infrastructure
· Least privilege · Automation with human control · Idempotency · Reproducibility
· Declarative infrastructure · Progressive complexity.

## Architecture summary

- **Modular monolith + worker** (ADR-0001). One deploy, one log, one trace;
  background work in workers consuming Postgres / Redis streams.
- **TypeScript first** (ADR-0002) — strict mode across web, api, worker, cli.
- **PostgreSQL 17** as system of record (ADR-0003), including the topology graph
  (BFS over per-tenant rows), audit log (append-only, partitioned), events
  (single table with migration options to Kafka/NATS later).
- **Provider abstraction** (ADR-0004) — `CloudProvider` interface, vendor SDK
  confined to `connectors/`.
- **In-process event bus** (ADR-0005) with append-only persistence; subscribers
  idempotent on `event.id`.
- **SSE before WebSockets** (ADR-0006) — `Last-Event-ID` cursor, heartbeat,
  per-org fan-out.
- **OpenTofu in a sandboxed container** (ADR-0007) — no host exec, no default
  network egress, plan + approval flow.
- **Cloud Simulator as a first-class provider** (ADR-0008) — every feature is
  demoable without cloud creds.
- **Multi-tenant by row scoping** (ADR-0009), Postgres RLS deferred until it's a
  real upgrade, not a placebo.
- **Human-approved destructive operations** (ADR-0010) — fail-closed by default
  for unknown actions.

## Resource model (Phase 2+)

- `CloudResource` — the central entity; ~25 declared types (VMs, containers, K8s
  artifacts, databases, caches, queues, load balancers, object storage,
  volumes, networks, subnets, firewalls, DNS, serverless, API gateways,
  secrets, certificates, applications, services, environments, "other").
- `ResourceNode` / `ResourceEdge` — the topology graph. ~15 relation kinds
  (`DEPENDS_ON`, `RUNS_ON`, `HOSTS`, `USES`, `READS_FROM`, etc).
- `BlastRadiusResult` — the visited subgraph of `DEPENDS_ON`/`HOSTS`/`USES`
  relations from a single root.

## Identity (Phase 1)

- `Organization`, `User`, `Membership`, `Session` — see `packages/domain`.
- RBAC roles: `OWNER`, `ADMIN`, `PLATFORM_ENGINEER`, `DEVOPS`, `SRE`,
  `SECURITY`, `FINOPS`, `DEVELOPER`, `VIEWER` (matrix in `packages/permissions`).
- Permission strings are an enum, not free strings — adding requires a code
  change.
- Audit row for every mutation, including 4xx/5xx.

## Demos (spec §55–59)

- **Black Friday Incident** (traffic spike → cascade).
- **Dangerous Deployment** (failed deploy → human rollback).
- **Cost Explosion** (autoscale intended → runaway cost).
- **Security Exposure** (storage bucket made public → policy violation).

Ships with the simulator connector (Phase 2).

## Phases

See [`ROADMAP.md`](./ROADMAP.md) for the canonical phase list and
[`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) for live status.

## Continuity rule

When instructed "Continue development":

1. Read this file (`PROJECT_SPEC.md`).
2. Read `IMPLEMENTATION_STATUS.md`.
3. Read the ADRs referenced by the current section.
4. Run tests and identify where work stopped.
5. Continue from that point — never restart the project.

## License

Apache 2.0.