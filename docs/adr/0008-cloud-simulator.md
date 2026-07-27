---
id: 0008
title: Cloud Simulator as a first-class provider
status: Accepted
date: 2026-07-27
---

# ADR-0008 — Cloud Simulator as a first-class provider

## Context
The platform must demonstrate its full value — topology, blast radius, FinOps, incidents,
deployments — without asking a recruiter or a self-hoster to plug in AWS credentials. The
demo experience matters; the demo is the project.

## Decision
The **Cloud Simulator** is implemented as a `simulator` connector (ADR-0004) at the same level
as AWS/Azure/GCP. It produces synthetic `CloudResource`, `ResourceEdge`, `CostRecord`,
`ResourceMetrics` and `AuditEvent` rows under a fixed seed.

Capabilities:
- Reproducible scenarios via seeded RNG (spec §14):
  `healthy-platform`, `high-cpu`, `database-overload`, `service-outage`, `cost-spike`,
  `deployment-failure`, `security-exposure`, `kubernetes-node-failure`, `network-latency`,
  `certificate-expiration`.
- A scripted narrative driver for the four named demo scenarios (Black Friday Incident,
  Dangerous Deployment, Cost Explosion, Security Exposure — spec §55–59), execuable in time
  compression (`cloud simulator --speed 60`).
- The simulator **is a real provider** — the same code path that runs against AWS reads from
  the simulator. No mock-only branches in the domain layer.

## Consequences
- ✅ Every feature is demoable end-to-end on a fresh `git clone`.
- ✅ Tests use the simulator connector instead of recorded SDK fixtures for integration paths.
- ⚠️ Real provider edge cases (eventual consistency, IMDS, IAM pagination) only surface on the
  real connector. Mitigated by per-connector contract tests, but a known gap.
- ⚠️ A "demo" that diverges from real behavior is worse than no demo. Mitigation: simulator
  is treated as production code; it lives next to the connectors and gets the same lint/tests.

## References
- Spec §14 Sandbox / Demo cloud, §55–59 Demo scenarios, §13 Provider abstraction