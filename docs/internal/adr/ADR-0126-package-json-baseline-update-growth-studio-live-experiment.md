# ADR-0126: Package.json Baseline Update For Growth Studio Live Experiment

## Status

Accepted

## Context

The gate integrity baseline (`.ci/gate-baseline.json`, see ADR-0041) tracks
`package.json` because script and workspace changes can silently weaken the CI
contract.

This bead adds one new `package.json` script:

- `experiment:growth-studio:live`

That script runs the committed live OpenClaw experiment harness at
`experiments/growth-studio-openclaw-live/run.mjs`.

The change is additive. It does not:

- remove or weaken any CI gate
- alter lint, typecheck, coverage, mutation, or architecture thresholds
- change dependency resolution behaviour
- modify workspaces

The gate baseline therefore needs regeneration only because `package.json` is a
critical hashed file, not because gate semantics changed.

## Decision

Accept the regenerated `package.json` baseline hash after adding the
`experiment:growth-studio:live` script.

This baseline update is considered a documentation and audit step for an
additive experiment entry point, not a gate-policy change.

## Consequences

- `npm run ci:gates` can pass again once the baseline is regenerated.
- The repo gains a stable, documented entry point for reproducing the live
  OpenClaw experiment from Git.
- Future `package.json` changes that affect CI, workspaces, or dependency
  behaviour still require separate impact analysis.
