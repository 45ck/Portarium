# Bead-0158: PE Master Execution DAG

## Scope

- `scripts/beads/generate-execution-dag.mjs`
- `docs/governance/master-execution-dag.md`

## Implementation Summary

- Added a deterministic DAG generator for open beads that reads
  `.beads/issues.jsonl` and produces a governance artifact with:
  - phase-level open/blocked/evidence summary;
  - open dependency graph (Mermaid) grouped by phase;
  - computed critical path across unresolved open dependencies;
  - per-bead dependency/evidence detail table.
- Implemented `--check` mode so the DAG can be validated in CI or local gates
  without rewriting the file.
- Generated the initial master DAG document from the current bead set.

## Verification

- `node scripts/beads/generate-execution-dag.mjs`
- `node scripts/beads/generate-execution-dag.mjs --check`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
