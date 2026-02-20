# Portarium (VAOP) -- Agent Guidelines

## For any AI agent working on this codebase

1. **Read CLAUDE.md first** — it contains the project rules and workflow order.
2. **Check `docs/glossary.md`** before naming anything — use the ubiquitous language.
3. **Never skip gates** — run `npm run ci:pr` before considering work complete.
4. **Track and claim work in Beads** — select work with `bd issue next`, claim it (`bd issue claim <id> --by "<owner>"`), then close/unclaim when done (or use `npm run bd -- ...` if `bd` isn't on PATH).
5. **Respect architecture boundaries** — domain cannot import infrastructure or presentation.
6. **Write tests first** (or alongside) — coverage thresholds are enforced in CI (see `vitest.config.ts`).
7. **Update specs** — if behaviour changes, update `.specify/specs/` or reference existing spec.

## Available skills

- `/quality-check` — run full quality gate suite
- `/architecture-guard` — validate architecture boundaries
- `/review-fagan` — formal inspection-style review
- `/security-scan` — security scanning
- `/qa-agent-browser` — browser-based QA sweep
- `/bd-sync` — synchronise work with Beads
