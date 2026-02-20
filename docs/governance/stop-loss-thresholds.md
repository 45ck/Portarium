# Stop-Loss Thresholds

This policy defines when the cycle must halt so unresolved risk does not leak into
implementation, review, or release activity.

## Halt Conditions

A cycle halt is mandatory when any one of these thresholds is met:

1. Risk score is `>= 6`.
2. Failed critical gates count is `>= 1`.
3. Unresolved open decision beads count is `>= 8`.

## Risk Score Model

Risk score is additive. Components are:

| Component                       | Points | Trigger                                |
| ------------------------------- | ------ | -------------------------------------- |
| Dependency deadlock present     | +4     | At least one open dependency cycle     |
| Orphaned beads threshold breach | +2     | Orphaned open beads `>= 20`            |
| Open P0 threshold breach        | +2     | Open `P0` beads `>= 5`                 |
| Unowned open beads breach       | +2     | Open beads without owner/claim `>= 25` |
| Unresolved decision breach      | +2     | Open decision beads `>= 8`             |

## Decision Bead Definition

A bead is counted as an unresolved open decision when it is open and title/body
contains one or more decision markers:

- `ADR`
- `spec`
- `decision`
- `semantics`
- `rule language`

## Enforcement Command

Evaluate and write status artifact:

```bash
npm run beads:stop-loss:status
```

Enforce halt decision (non-zero exit when halt condition is met):

```bash
npm run beads:stop-loss:enforce -- --failed-gates ci:pr
```

Gate failures should be passed in from current cycle context (`ci:pr`,
`architecture-guard`, etc.).

## Artifacts

- Policy: `docs/governance/stop-loss-thresholds.md`
- Latest evaluation: `docs/governance/stop-loss-thresholds-status.md`
