---
id: 0001
title: Modular monolith before microservices
status: Accepted
date: 2026-07-27
---

# ADR-0001 — Modular monolith before microservices

## Context
The Alpha Cloud spans many bounded contexts: inventory, topology, deployment, observability, FinOps,
security, IaC, automation, Kubernetes, drift. Splitting these into separate deployables on day
one is a known anti-pattern: it pays the network and operational cost of microservices before
their boundaries are proven.

## Decision
Start as a **modular monolith with worker processes**, structured as one TypeScript repository
with explicit module boundaries. Each domain lives in its own package, but they share the same
runtime by default. Background work (discovery, drift sweeps, deploy executions) runs on
workers consuming an internal job/event bus, never the API request line.

Microservices are deferred **until a module has a verifiable reason** to deploy independently:
different scale, different release cadence or security isolation that the monolith cannot
provide.

## Consequences
- ✅ Lower operational cost (one deploy, one log, one trace).
- ✅ Boundary violations are still enforceable via ESLint rules + import boundaries and tests.
- ✅ Schema migration happens in a single transactional unit.
- ⚠️ Module discipline becomes mandatory — no ad-hoc cross-imports. ADR-0009 (multi-tenancy)
  depends on every query carrying an `organizationId`; a leaky monolith makes that hard.
- ⚠️ Extracting a service later requires its data to be already cleanly owned by the module.

## Alternatives considered
- **Microservices from day one**: rejected — premature boundary freeze, ops cost, harder
  cross-tenant joins for audit.
- **Pure monolith (no module isolation)**: rejected — would make future extraction too
  expensive and violate "domain separation" (spec §65).

## References
- Spec §6 Architecture, §65 Internal architecture
- ADR-0005 (event core), ADR-0009 (multi-tenant)