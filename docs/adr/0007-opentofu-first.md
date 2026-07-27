---
id: 0007
title: OpenTofu-first IaC executed in a sandbox
status: Accepted
date: 2026-07-27
---

# ADR-0007 — OpenTofu-first IaC executed in a sandbox

## Context
The IaC engine (spec §20) must run modules provided by users — possibly third-party — and
return plans/diffs without exposing the host. Running OpenTofu directly on the API server is a
remote command-execution surface for untrusted input.

## Decision
**OpenTofu** (not Terraform binary) is the primary IaC engine, mirroring Terraform syntax
where compatibility holds. Helm and raw Kubernetes manifests are first-class inputs for the
deployment engine (ADR deferred to Phase 11), but OpenTofu is the language the IaC module
talks to.

Execution rules:
- IaC runs **inside an isolated container** (rootless Docker / Podman via the `docker`
  connector in Phase 2, then Kubernetes pod in Phase 14). Never on the API host.
- The container has **no network egress** to cloud provider APIs by default; egress is granted
  per-run via explicit allow-list filtered to the target provider's endpoints, only after
  `human_approval` is recorded.
- Plan output is parsed out of the container into the database; **apply** requires a recorded
  approval (ADR-0010).
- Backend state is stored in the platform's Postgres/S3 — never in the user's container
  filesystem.

## Consequences
- ✅ Untrusted HCL cannot reach host filesystem or arbitrary network.
- ✅ State cannot drift on a per-environment basis; it is centralized.
- ⚠️ Self-hosters need a container runtime to use IaC at all. Acceptable — CLOUD stops here,
  not silently runs OpenTofu bare on host.

## Alternatives considered
- **Terraform binary**: license considerations since the BSL change; OpenTofu is the
  open-source successor.
- **Pulumi**: language-agnostic but requires the platform to host a runtime; deferred.
- **Bare exec with seccomp**: too brittle for self-hosters.

## References
- Spec §7 IaC, §20 IaC, §50 Security, §68 Prohibitions (no host IaC exec)