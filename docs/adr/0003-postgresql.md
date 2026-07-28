---
id: 0003
title: PostgreSQL as the system of record
status: Accepted
date: 2026-07-27
---

# ADR-0003 — PostgreSQL as the system of record

## Context
The Alpha Cloud stores a graph of cloud resources, audit events, deployment records, accounts/orgs/roles,
cost records, security findings and policy evaluations. Most of this is relational (rows with
joins on `organizationId`, `resourceId`, `userId`), but the topology graph has graph shape.

## Decision
**PostgreSQL 17** is the system of record for all transactional state.

- **Topology graph** stays in Postgres (nodes + edges tables, indexed by org), not in a graph
  database. Blast-radius traversal is a bounded BFS over a per-organization subgraph — the
  largest realistic graphs (tens of thousands of resources) fit comfortably with proper indexes.
- **Audit log** lives in the same cluster, in a separate schema, with append-only enforcement
  via `REVOKE UPDATE, DELETE` from the application role. Retention enforced by partitioning
  by month rather than row deletion.
- **Migrations** are plain SQL, applied by a tiny runner in `apps/api/src/db`. No ORM. SQL is
  reviewable and survives framework churn.
- **Object storage** (MinIO in dev, S3 in prod) only stores truly binary blobs: IaC plan files,
  container images SBOMs, raw log archives. Postgres never holds bytes over a few KB
  (`metadata` columns stay JSONB with a hard cap).
- **Redis** is for ephemeral/lookup work — sessions, rate-limit counters, SSE cursor map,
  job queue. Nothing in Redis is the source of truth.

## Consequences
- ✅ Single ACID boundary for cross-module writes (audit + state mutation in one tx).
- ✅ Tenant isolation is enforceable at row level (RLS optional upgrade, see ADR-0009).
- ⚠️ Hand-written SQL = discipline required; mitigate with a thin typed query layer
  (`apps/api/src/db/queries.ts`) and `pg-types` baseline.
- ⚠️ Graph queries over 100k nodes may outgrow Postgres → revisit if/when a tenant reaches it.
  Not now.

## Alternatives considered
- **MongoDB**: weak transactions across the multi-tenant graph; rejected.
- **Neo4j**: better graph fit but adds a second datastore, more failure modes, extra ops for
  self-hosters. Deferred — proven to be premature without measured need.
- **Prisma**: rejected; opaque migrations and SQL you can't read is the wrong default for an
  infra control plane that demonstrates SQL fluency.

## References
- Spec §7 Stack, §41 Multi-tenancy, §39 Audit
- ADR-0009 (multi-tenant)