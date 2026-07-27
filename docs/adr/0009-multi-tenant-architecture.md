---
id: 0009
title: Multi-tenant by row scoping, with Postgres RLS as upgrade
status: Accepted
date: 2026-07-27
---

# ADR-0009 — Multi-tenant by row scoping, with Postgres RLS as upgrade

## Context
CLOUD is multi-tenant: every organization must only see its own data. Spec §41 declares that
no query can return data from another tenant. Trusting every call site in every module to do
this by hand is brittle.

## Decision
**Two layers of defence:**

1. **Mandatory `organizationId` on every tenant-scoped row.** Every table that holds tenant
   data has `organization_id UUID NOT NULL`, an index on it, and a foreign key to `organizations`.
   The DB query layer (`apps/api/src/db`) rejects any query missing an `organizationId` predicate
   for those tables — a runtime check that fails loudly in tests, silently in prod (logs +
   audit) when a developer forgets it.

2. **Application-layer tenant guard middleware** in Fastify that resolves the current tenant
   from the authenticated session and stores it in `request.tenant`. Endpoints that touch
   tenant data MUST read tenant from `request.tenant`, never from query/body.

**Postgres Row-Level Security (RLS)** is OFF at launch — it requires a config discipline and
a connection-per-tenant model that fight the monolith's pool — but the schema is shaped so
RLS can be enabled per-table later by adding a `current_setting('cloud.tenant')` predicate.
This is documented as a hardening step in `SECURITY.md`.

Tenant isolation tests (spec §41) get a dedicated `tests/tenant-isolation/` folder and run on
every PR. Minimum coverage 95%.

## Consequences
- ✅ Tenant scoping is enforced by code path, not by developer memory.
- ✅ RLS upgrade path exists without a schema rewrite.
- ⚠️ Cross-tenant admin queries (system-level tasks, super-admin) need an explicit bypass
  path — documented and only used by `OWNER`-level platform admin endpoints.
- ⚠️ Room for a "deleted org" bug — `organization_id` foreign key is `ON DELETE RESTRICT`;
  deleting an org is its own guarded flow (TODO Phase 2).

## Alternatives considered
- **Database-per-tenant**: ops overhead for self-hosters; rejected.
- **RLS only, day one**: rejected — coupling connection pools to a tenant setting costs too
  much simplicity for the current scale.

## References
- Spec §41 Multi-tenancy, §39 Audit, §52 Testing (tenant isolation ≥ 95%)