---
id: 0005
title: Event-driven core with an internal bus
status: Accepted
date: 2026-07-27
---

# ADR-0005 — Event-driven core with an internal bus

## Context
A control plane's value depends on reacting to state changes: a resource was discovered, a
deployment failed, a cost crossed a threshold, a policy was violated. Hardcoding these flows
as method calls couples producers to consumers and makes "audit everything" harder.

## Decision
All domain mutations emit an **`EventEnvelope`** (spec §42) on an internal in-process bus
backed by Postgres + (optional) Redis streams for cross-process delivery to workers.

- Every `write` path: mutate state in tx → insert event row in same tx → emit after commit.
- Workers subscribe by event type and never coordinate via cron polls where avoidable.
- The envelope has `id`, `type`, `version`, `organizationId`, `source`, `entityId`,
  `correlationId`, `causationId`, `occurredAt`, `payload`.
- Events are **append-only** (see ADR-0003 audit partition); they are also the audit source of
  truth — `AuditEvent` (spec §39) is a *projection* of system events + actor-attributed actions.

## Consequences
- ✅ Cross-cutting features (audit, alert, recommendation, indexing) subscribe to the same bus.
- ✅ `correlationId` makes "what caused what" reconstructable across services.
- ⚠️ Strictly at-least-once: subscribers must be idempotent, keyed on `event.id`.
- ⚠️ Tests must exercise the bus end-to-end to prove subscribers do not silently drop.

## Alternatives considered
- **Kafka/NATS**: ops overhead for self-hosters; deferred until throughput demands it.
- **Direct method calls**: rejected — couples modules and breaks "audit everything".

## References
- Spec §42 Event system, §21 Cost engine, §39 Audit, §29 Incidents