## Summary

<!-- What changes, why it is needed, and which roadmap item or issue it addresses. -->

## Risk and boundaries

- [ ] Tenant data keeps an explicit `organization_id` boundary
- [ ] Mutating endpoints emit the required audit event
- [ ] Destructive operations still fail closed behind approval
- [ ] No secrets, credentials, or production identifiers are included

## Verification

- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Documentation or an ADR was updated when required

## Evidence

<!-- Paste concise test output, screenshots, or a reproducible scenario. -->

## Not verified

<!-- State any limitation explicitly. Write "None" only when all relevant paths ran. -->
