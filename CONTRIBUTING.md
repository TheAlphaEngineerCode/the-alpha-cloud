# Contributing to CLOUD

Thanks for being here. The short version:

- **Open source, Apache 2.0.** See [`LICENSE`](./LICENSE).
- **One language end-to-end.** TypeScript strict. New code without strict typing
  is not accepted. See ADR-0002.
- **Modular monolith.** Don't split into services without justification. See
  ADR-0001.
- **Tenant boundary sacred.** Any new table that holds tenant data MUST have
  `organization_id NOT NULL` + index; repository queries MUST receive the
  tenant from `request.cloud.tenant`, never from query/body. See ADR-0009.
- **Audit every mutation.** Any new mutating endpoint MUST set `request.auditPatch`
  with action + resourceType/resourceId. Audit tests pass/fail-future.
- **Destructive actions fail closed.** A new `DESTRUCTIVE` action requires an
  approval row. See ADR-0010.
- **No AI attribution.** Don't end commits with `Co-Authored-By: Claude` or
  anything similar. The repository is a portfolio public artifact; commits stay
  clean.

## Local checklist

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

A PR that does not have all three pass against the **lowest** matrix Node version
(see `engines.node` and CI `.github/workflows/ci.yml`) does not merge.

## Conventions

- **Language:** English in code, comments, commit messages, docs. README is
  English to match portfolio public surface.
- **Naming:** PascalCase for types, camelCase for variables, kebab-case for
  files (except `README.md`, `ARCHITECTURE.md` and similar repository-wide top
  level files).
- **Branded id types:** every domain id (OrganizationId, UserId, etc.) is a
  `Brand<string, 'XId'>`. Don't pass raw `string` across module boundaries —
  construct via the helpers in `@cloud/domain`.
- **Imports:** prefer `type` for type-only imports (lints enforce it where
  possible given the `isolatedModules` flag).
- **Tests:** a feature without a tenant-isolation test is a feature missing a
  test. The repository has `tests/tenant_isolation/` as a convention.

## Commit messages

Use Conventional Commits:

```
<type>(<scope>): <subject>

<body optional>

<footer optional — never AI attribution>
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.

## ADR discipline

Architectural decisions live in `docs/adr/`:

- `NNNN-<kebab-title>.md` per file, monotonically numbered.
- Status: `Proposed`, `Accepted`, `Superseded by ADR-NNNN`, `Deprecated`.
- One decision per ADR; don't edit a published ADR — supersede it.

## Pull requests

- One concern per PR. A multi-phase feature gets split.
- The PR description links to the target phase in `ROADMAP.md` or to a tracking
  issue.
- Don't disable lint with `eslint-disable` without an ADR-style justification in
  a comment next to the line.

## Reviews

- Self-hosters are first-class. A change that requires a heavy new
  datastore/runtime/agent without an ADR is a review blocker.
- Backwards compatibility: rename via deprecation, not destructive rename.

## Need help?

Open an issue with `kind: question`. Replies are async — we don't promise
real-time.