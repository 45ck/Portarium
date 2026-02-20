# Bead-0187: Contributor Onboarding Guide

## Scope

- `docs/getting-started/contributor-onboarding.md`
- `docs/index.md`
- `docs/getting-started/dev-workflow.md`
- `docs/development-start-here.md`
- `README.md`
- `CONTRIBUTING.md`

## Implementation Summary

- Added a dedicated self-serve onboarding guide that explains:
  - mandatory reading order (`CLAUDE.md`, glossary, workflow docs);
  - Beads schema fields in `.beads/issues.jsonl`;
  - one-bead-at-a-time claim/unclaim/close lifecycle;
  - review and closure requirements and prerequisite checks.
- Wired the guide into all main contributor entrypoints so it is discoverable
  from docs and repository top-level files.

## Verification

- `npx prettier --check docs/getting-started/contributor-onboarding.md docs/index.md docs/getting-started/dev-workflow.md docs/development-start-here.md README.md CONTRIBUTING.md`
- `npx cspell --no-progress --config cspell.json docs/getting-started/contributor-onboarding.md docs/getting-started/dev-workflow.md docs/development-start-here.md README.md CONTRIBUTING.md`
- `npm run ci:pr` (still blocked by existing repo-wide lint baseline outside this bead)

## Notes

- This bead is documentation-only and does not change runtime behavior.
