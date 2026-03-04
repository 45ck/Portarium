# ADR-0119: Gate Baseline Update for Node 20 LTS Minimum

## Status

Accepted

## Context

The gate integrity baseline (`.ci/gate-baseline.json`, see ADR-0041) tracks SHA-256
hashes of critical configuration files, including `package.json` and `cspell.json`.

As part of the Node 20 LTS upgrade (bead-0862), the following gate-tracked files
changed:

1. **`package.json`** -- the `engines.node` field was lowered from `>=22.0.0` to
   `>=20.0.0` to support the Node 20 LTS release line. This widens the set of
   supported runtimes; it does not weaken any enforcement gate.
2. **`cspell.json`** -- added project-specific dictionary words (`tunneling`,
   `agentactionproposal`) that appeared in agent-governance code. These are
   additive spell-check entries and do not suppress or weaken any spelling rules.

Both changes are non-enforcement-weakening. No lint rules, coverage thresholds,
architecture boundaries, or test gates were altered.

## Decision

Accept the updated gate baseline hashes for `package.json` and `cspell.json` as
legitimate. The changes fall into the "no enforcement weakening" category
described in ADR-0041 and require only this documentation record rather than a
gate-policy review.

The Node 20 minimum was chosen because:

- Node 20 is the current LTS "Iron" release, supported until April 2026.
- ESLint 9 (used by the project) requires `Array.prototype.toReversed()`,
  available from Node 20+.
- Storybook 8 requires Node 20+.
- Lowering from 22 to 20 improves developer onboarding flexibility without
  compromising any runtime feature the codebase depends on.

## Consequences

- The gate baseline is now current with the checked-in `package.json` and
  `cspell.json`.
- `npm run ci:gates` passes on a clean checkout of `main`.
- This ADR provides the audit trail required by ADR-0041 for baseline updates.
- No enforcement semantics were weakened; no rollback or additional gate
  hardening is needed.
