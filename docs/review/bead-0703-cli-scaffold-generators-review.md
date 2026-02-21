# Bead-0703 Review: CLI Scaffold Generators

## Scope

- Add CLI scaffolding commands for adapter and agent-wrapper generation.
- Provide deterministic local output structure for integration bootstrapping.

## Changes

- Extended `src/cli/portarium-cli.ts`:
  - Added `generate adapter` and `generate agent-wrapper` command handling.
  - Added filesystem scaffold helpers with overwrite protection (`--force`).
  - Added exported generator functions for test coverage.
- Extended `src/cli/portarium-cli.test.ts`:
  - Added parser test for `generate adapter`.
  - Added scaffold creation and force-overwrite behavior tests.
- Added `npm` script:
  - `cli:portarium` in `package.json`.
- Added operator doc:
  - `docs/how-to/generate-integration-scaffolds.md`.

## Validation

- `npm run ci:pr`
