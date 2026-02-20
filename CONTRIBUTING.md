# Contributing to Portarium

## Workflow Order

Follow this order for every contribution:

Spec -> Tasks (Beads) -> Implement -> Tests -> Quality gates -> Review -> QA -> Merge.

## Required Reading

- `CLAUDE.md`
- `AGENTS.md`
- `docs/glossary.md`
- `docs/development-start-here.md`

## Task Tracking

Use Beads for all work.

```bash
npm run bd -- issue next --priority P1
npm run bd -- issue view bead-XXXX
```

Commit `.beads/issues.jsonl` with related code changes.

## Quality Gates

Before opening or updating a PR:

```bash
npm run ci:pr
```

Do not mark work complete unless this passes.

## Architecture and Contracts

- Keep domain layer free of infrastructure/presentation dependencies.
- Add or update specs in `.specify/specs/` when behavior changes.
- Add or update ADRs in `docs/adr/` for architectural decisions.

## Review Evidence

In your PR description include:

- linked Bead IDs
- changed specs/ADRs
- test and gate evidence
- notable risks or follow-up tasks
