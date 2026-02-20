# Getting Started: Development Workflow

Portarium uses a strict execution order:

Spec -> Tasks (Beads) -> Implement -> Tests -> Quality gates -> Review -> QA -> Merge.

## 1) Read project rules and language

- `CLAUDE.md`
- `docs/glossary.md`
- `docs/development-start-here.md`

## 2) Pick work from Beads

```bash
npm run bd -- issue next --priority P1
npm run bd -- issue view bead-XXXX
```

## 3) Implement with tests

- Keep domain boundaries enforced (`src/domain` has no infra/presentation imports).
- Keep terminology aligned with glossary definitions.

## 4) Run full PR gates

```bash
npm run ci:pr
```

## 5) Open PR with evidence

Include:

- changed spec/ADR references
- test evidence
- gate output summary

## Useful commands

```bash
npm run test
npm run lint
npm run format:check
npm run spell
```
