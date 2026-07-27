---
id: 0002
title: TypeScript-first across the stack
status: Accepted
date: 2026-07-27
---

# ADR-0002 — TypeScript-first across the stack

## Context
CLOUD touches frontend (topology graphs, dashboards, ACE editors), backend (auth, RBAC,
inventory, event bus), CLI, connectors and infrastructure glue. Polyglot stacks pay a tax in
serialization contracts, duplicated domain types and slower iteration.

## Decision
**TypeScript everywhere**, including the API, web, worker, CLI and all packages. Strict mode
with `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` and `noImplicitReturns`.
The only exception is **OpenTofu/Terraform HCL**, which is its own language and runs in a
sandbox (ADR-0007).

Go is **not** introduced at this stage. If a component later demonstrates a need for sustained
high concurrency or sub-millisecond hot paths (audit log ingestion, metrics fan-out), the
extraction will happen *with* a typed contract (Protobuf / OpenAPI), not as a casual crossover.

## Version pins
- **TypeScript 5.9.3** (not 7.x). At decision time, `typescript-eslint@8.x` declares
  `typescript <6.1.0` as its peer; TS 7 would disable linting with type information, which is
  exactly what catches type leaks in the domain layer. Migration trigger: when
  `typescript-eslint` declares TS 7.x support and we have run lint green on a branch.
- **Node.js ">=22.13.0"**. Lowest matrix version MUST be exercised by CI; an advertised floor
  the package manager cannot support is a documentation lie (cf. lesson in [[Alpha Graph Code]]
  diary).

## Consequences
- ✅ One language, one type system, one linter config.
- ✅ Types travel from DB row to API response to frontend query via generated OpenAPI + TanStack.
- ⚠️ Some heavy vendor SDKs ship better Go bindings than TS — surfaced again at ADR-0004.
- ⚠️ Pin discipline: any new dep that requires a TS major bump triggers a check of the lint peer.

## Alternatives considered
- **Go for API + TS for web**: rejected for monorepo simplicity and shared domain package.
- **Bun runtime**: not yet — Node LTS has the long-tail ecosystem (node:crypto, sails of
  pg/redis drivers).

## References
- Spec §7 Stack, §64 Code rules
- [[Alpha Graph Code]] diary entry — TypeScript 5.9.3 rationale