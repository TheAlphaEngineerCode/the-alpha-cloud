# Roadmap

Phases the project ships in. **Each phase is a deployable milestone** — passing
tests, no `TODO` markers on essential paths, README + ADRs aligned.

> Live progress lives in [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md).

## Phase 0 — Foundation
- Monorepo (pnpm + Turborepo).  ✓
- Next.js app shell, Fastify API shell, worker, cli scaffolds.  ✓
- PostgreSQL + Redis + MinIO via `docker compose up`.  ✓
- TypeScript strict, ESLint typed, Vitest, Prettier, tsconfig.  ✓
- GitHub Actions CI: install / lint / typecheck / test / build / secret scan.  ✓
- Documentation skeleton: README, SECURITY, THREAT_MODEL, CONTRIBUTING, ADRs.  ✓
- ADRs 0001–0010.  ✓

## Phase 1 — Identity
- Authentication (register / login / logout / me).  ✓
- Argon2id password hashing, opaque session tokens stored as SHA-256.  ✓
- Organizations, memberships, RBAC matrix.  ✓
- Tenant isolation at the repository layer + tenant middleware.  ✓
- Audit row written on every mutation, including 4xx/5xx.  ✓
- Tests: auth, RBAC enforcement, tenant isolation, audit recording.  ✓

## Phase 2 — Cloud Inventory
- `CloudProvider` interface compiled and tested.
- Local Provider + Simulator Provider deliver a fixed seeded graph.
- Inventory: filters, dashboard, "Alpha Cloud Labs" demo data.
- Contractor "discovery" periodic sweep worker extracts state to Postgres.

## Phase 3 — Topology
- ResourceNode / ResourceEdge models + per-tenant BFS.
- Blast Radius Engine reaches the first 3 result fields.
- React Flow topology view in the web UI.
- Demo: black friday cascade scenario playable from the console.

## Phase 4 — Application Platform
- Application concept: services, environments, ownership.
- Application Catalog: list / inspect / dependency tree.
- Per-app health rollup (skeleton — SLO is Phase 8).

## Phase 5 — Deployment Engine
- Deployment entity + Rollout states (rolling only; blue/green + canary Phase 5.5).
- Release view with Git history + resource changes + metrics overlay.
- Rollback simulation (no real deploy target — works against simulator).

## Phase 6 — Kubernetes
- `KubernetesProvider` + pod/deployment/service/ingress read APIs.
- Cluster explorer UI, namespace / node / pod canonical surfaces.
- Kubernetes Health: CrashLoopBackOff, OOMKilled, ImagePullBackOff detectors
  correlated across rollout + node failures.

## Phase 7 — Observability
- Metrics + Logs + Traces surfaced from OTEL collectors fed by the simulator.
- Service Health page with availability / latency / error-rate rollups.
- Live incident timeline aggregating alerts + deployments + clock events.

## Phase 8 — SRE
- SLO definitions + Error Budget tracking.
- Incident lifecycle (SEV1–4) + commander + timeline + auto-correlated events.
- Alert ingestion from Alertmanager-style sources.

## Phase 9 — FinOps
- CostRecord ingest per provider; current / projected / per-app dashboards.
- Cost Anomaly Detector: 184% increase overnight on one resource, etc.
- Recommendation engine v1 (rule-based).

## Phase 10 — Security
- Per-tenant policy engine (declarative + own DSL).
- Security dashboard: exposed ports, public resources, leaked secrets,
  outdated deps, misconfigs, expired certs, excessive IAM.
- SBOM ingestion + Grype / Trivy findings correlated across nodes.

## Phase 11 — Infrastructure as Code
- OpenTofu sandbox container exec via the docker connector.
- Plan / validate / diff / approval (+ dry-run by default).
- Drift detection (`Declared` vs `Actual`) on schedule.

## Phase 12 — Automation
- Trigger → Conditions → Actions → Approval → Execution → Verification.
- Executable runbooks with dry-run + permissions + audit.

## Phase 13 — Real Providers
- AWS connector first, Azure later, GCP later — never all required at once.
- Cloud credential encrypted storage (envelope keys per tenant).

## Phase 14 — Production Hardening
- Helm chart for self-hosters, Postgres RLS upgrade path, backup/restore.
- Observability of the platform itself + ServiceSignalHealth.
- Final security audit (threat model walkthrough, dep audit, SBOM published).

## Branches off the phased plan

- **Phase 4.5** — Cloud Copilot (AI-assist): answers "What changed in production?"
  by introspecting audit + inventory. Not implemented before Phase 4 because it
  needs both Application catalog (Phase 4) and Audit (Phase 1).
- **Phase 5.5** — Blue/green + Canary on top of the rolling baseline.

Each milestone commits a README patch + `IMPLEMENTATION_STATUS.md` update +
ADR if a decision was made.