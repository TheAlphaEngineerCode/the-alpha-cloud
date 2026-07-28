---
id: 0010
title: Human-approved destructive operations
status: Accepted
date: 2026-07-27
---

# ADR-0010 — Human-approved destructive operations

## Context
The Alpha Cloud can mutate real infrastructure: apply OpenTofu modules, scale or restart Kubernetes
deployments, run automations, delete tracked resources. Automation with no human gate for
destructive actions is the single biggest operational liability of a control plane.

## Decision
Any operation that can destroy, mutate live infrastructure, or change state in production
MUST:

1. Be classified `DESTRUCTIVE` or `MUTATING` in the action registry
   (`packages/domain/src/actions.ts`).
2. Require an explicit **approval record** — a row in `approvals` with `requestedBy`,
   `approvedBy`, `reason`, and a per-action TTL — before the action runs.
3. Run in `dry-run` mode by default when the action supports it; the recorded approval marks
   the actual execution.
4. Emit a `*.request` + `*.approved` + `*.completed` event chain (ADR-0005).

Examples classified `DESTRUCTIVE`:
- `infrastructure.apply`, `cluster.deployment.restart`, `cluster.deployment.scale`,
  `automation.execute(DESTRUCTIVE)`, `organization.delete`, `resource.delete`.

Examples classified `MUTATING`:
- `deployment.create`, `policy.update`, `provider.connect`, `secret.set`, `invitation.create`.

Examples classified `READ`:
- `infrastructure.plan`, `cloud.discover`, `logs.read`, `metrics.read`, `cost.read`.

**The default policy** is: if the action is unknown, treat it as `DESTRUCTIVE`. This is the
fail-closed direction — an unclassified action can never silently bypass approval.

## Consequences
- ✅ Fail-closed by construction for unknown actions.
- ✅ Audit log is the execution record — every mutation carries `approvalId`.
- ⚠️ Automations waiting for approval look "stuck" to users; UI must surface pending approvals
  prominently.
- ⚠️ CI must fail when a new `DESTRUCTIVE` action is added without an approval path in tests.

## Alternatives considered
- **Role-based allow-list only**: rejected — a high-priv user running a mistaken `apply` still
  destroys; the approval row is a paper trail the platform cannot avoid.
- **Auto-approve for staging**: rejected — staging is production-shaped; bug cost is high.

## References
- Spec §35 Automation engine, §20 IaC, §50 Security, §68 Prohibitions
- ADR-0005 (events), ADR-0009 (tenant)