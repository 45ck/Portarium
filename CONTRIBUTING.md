# Contributing to Portarium

## Workflow Order

Follow this order for every contribution:

Spec -> Tasks (Beads) -> Implement -> Tests -> Quality gates -> Review -> QA -> Merge.

## Required Reading

- `docs/getting-started/contributor-onboarding.md`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/glossary.md`
- `docs/development-start-here.md`

## Task Tracking

Use Beads for all work.

```bash
npm run bd -- issue next --priority P1
npm run bd -- issue view bead-XXXX
npm run bd -- issue start bead-XXXX --by "<owner>"
# when paused/handed off
npm run bd -- issue unclaim bead-XXXX --by "<owner>"
# when completed
npm run bd -- issue finish bead-XXXX
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
- Add or update ADRs in `docs/internal/adr/` for architectural decisions.

## Review Evidence

In your PR description include:

- linked Bead IDs
- changed specs/ADRs
- test and gate evidence
- notable risks or follow-up tasks

## Repo Hygiene: Temporary and Scratch Paths

The following paths are excluded from git, lint, format, spell-check, and CI gates.
Do not commit files to these locations; they exist only for local ad-hoc work.

| Path pattern                                             | Purpose                                  |
| -------------------------------------------------------- | ---------------------------------------- |
| `tmp/`, `.tmp/`                                          | Transient tool output, build scratch     |
| `scratch/`                                               | Manual experimentation / throwaway code  |
| `tmp_*`, `tmp-*`                                         | One-off generator scripts (root level)   |
| `*.local.ts`, `*.local.js`, `*.local.mjs`, `*.local.cjs` | Local-only overrides and scratch modules |
| `gen*.js`, `gb*.js`, `build_gen*.js`                     | Code-generation scratch scripts          |

To clean all local scratch artifacts before running CI:

```bash
rm -rf tmp/ .tmp/ scratch/ && rm -f tmp_* tmp-* gen*.js gen*.cjs gen*.mjs gb*.js gb*.cjs gb*.mjs build_gen*.js build_gen*.cjs build_gen*.mjs *.local.ts *.local.js *.local.mjs *.local.cjs
```

## License

By contributing, you agree that your contributions are licensed under the MIT License in `LICENSE`.
