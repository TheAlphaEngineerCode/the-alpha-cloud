---
id: 0004
title: Provider abstraction with the cloud never leaking
status: Accepted
date: 2026-07-27
---

# ADR-0004 — Provider abstraction with the cloud never leaking

## Context
CLOUD must support AWS, Azure, GCP, Kubernetes, Docker and local — without any provider SDK
becoming part of the core. Letting `aws-sdk` calls escape the connector would couple
inventory, cost and topology logic to one vendor and make adding providers a rewrite.

## Decision
Define a single TypeScript interface — `CloudProvider` (see `packages/domain/src/providers/`)
— that the core depends on. Every connector under `connectors/` implements it.

```ts
interface CloudProvider {
  readonly id: string;
  readonly kind: 'aws' | 'azure' | 'gcp' | 'kubernetes' | 'docker' | 'local' | 'simulator';
  discoverResources(): Promise<readonly CloudResource[]>;
  getResource(id: string): Promise<CloudResource | null>;
  getMetrics(id: string, range: MetricsRange): Promise<readonly ResourceMetrics[]>;
  getCostData(period: CostPeriod): Promise<readonly CostRecord[]>;
  validateCredentials(): Promise<ValidationResult>;
}
```

Rules enforced by ESLint import boundary checks in CI:
- The `packages/*` set MUST NOT import from `connectors/*` or from any provider SDK
  (`@aws-sdk/*`, `@azure/*`, `@google-cloud/*`).
- Connectors MUST return only types from `@cloud/domain` — no vendor-native objects.
- ADR records the only accepted exception: a connector may import a vendor SDK into its own
  package boundary.

The first two real providers (Phase 13) ship behind feature flags.

## Consequences
- ✅ New provider = new package under `connectors/`, no core changes.
- ✅ Fake `simulator` provider (ADR-0008) lets the entire UI/UX work without any cloud account.
- ⚠️ Abstraction is leaky by default unless tested; we add contract tests per connector.
- ⚠️ Some metrics/cost semantics don't map cleanly across vendors — when they don't, the
  connector normalizes to a documented Cloud-domain field and drops the rest into `metadata`.

## Alternatives considered
- **Crossplane-style CRDs**: heavy, requires Kubernetes to host the platform itself.
- **Pulumi Automation API**: ties the platform to a vendor's API surface.

## References
- Spec §13 Provider abstraction, §8 structure (`connectors/`)