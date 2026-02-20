# Getting Started: Development Workflow

Use this workflow for all engineering changes in this repository.

Portarium uses a strict execution order:

Spec -> Tasks (Beads) -> Implement -> Tests -> Quality gates -> Review -> QA -> Merge.

## 1) Read project rules and language

- `docs/getting-started/contributor-onboarding.md`
- `CLAUDE.md`
- `docs/glossary.md`
- `docs/development-start-here.md`

## 2) Pick work from Beads

```bash
npm run bd -- issue next --priority P1
npm run bd -- issue view bead-XXXX
npm run bd -- issue claim bead-XXXX --by "<owner>"
```

If you start untracked work, create a bead first.

## 3) Implement with tests

- Keep domain boundaries enforced (`src/domain` has no infra/presentation imports).
- Keep terminology aligned with glossary definitions.

## 4) Run full PR gates

```bash
npm run ci:pr
```

If this fails, do not mark work complete.

## 5) Open PR with evidence

Include:

- changed spec/ADR references
- test evidence
- gate output summary
- bead claim/close state updated (`issue close` or `issue unclaim`)

## Fast Checklist

- Read rules and glossary
- Confirm bead linkage
- Implement with tests
- Pass `npm run ci:pr`
- Attach evidence in PR

## Useful commands

```bash
npm run test
npm run lint
npm run format:check
npm run spell
```
