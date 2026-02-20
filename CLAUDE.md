# Portarium (VAOP) -- Project Rules

## Workflow order (always follow)

Spec → Tasks (bd) → Implement → Tests → Quality gates → Review → QA → Merge.

## Non-negotiables

- Run `npm run ci:pr` before claiming any work is done.
- No new public API without a contract (types + boundary test).
- Update `.specify/specs/` for behaviour changes; add ADR under `docs/adr/` for design changes.
- Use `bd` (Beads) for all work tracking; commit `.beads/issues.jsonl` with code changes.
  - If `bd` isn't installed globally, use `npm run bd -- ...` (e.g. `npm run bd -- issue list --json`).
- For UI/user-flow changes: run `/qa-agent-browser` and attach traces/screenshots.
- Domain code (`src/domain/`) must have zero external dependencies (no infra, no presentation imports).
- All domain types use branded primitives from `src/domain/primitives/`.
- Hybrid architecture boundary is fixed: orchestration for run correctness + CloudEvents for external choreography (ADR-0070).

## Architecture layers (enforced by dependency-cruiser)

- `src/domain/` — entities, value objects, domain rules, domain events (no HTTP/DB)
- `src/application/` — use-cases, orchestration, transactions, permissions
- `src/infrastructure/` — DB, external APIs, queues, adapters
- `src/presentation/` — HTTP handlers, UI, CLI

## Commands

- Quick check: `npm run ci:pr`
- Deep check: `npm run ci:nightly`
- Tests: `npm run test` or `npm run test:watch`
- Lint fix: `npm run lint:fix && npm run format`

## Naming conventions

- Use ubiquitous language from `docs/glossary.md` — one concept, one name.
- Commands (imperative): `ActivateSubscription`, `CancelWorkflow`
- Events (past tense): `WorkflowActivated`, `ApprovalGranted`
- Domain primitives: branded types (`TenantId`, `WorkflowId`, etc.)
