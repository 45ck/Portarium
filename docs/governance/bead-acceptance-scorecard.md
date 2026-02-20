# Bead Acceptance Scorecard

This scorecard defines a consistent PE acceptance rubric for every bead.

## Scoring model

- Scale per dimension: `0` (missing), `1` (partial), `2` (meets), `3` (exceeds).
- Total score: sum of all dimensions (`0-21`).
- Minimum to close implementation beads: `>= 14` and no dimension below `1`.
- Minimum to close review/governance beads: `>= 12` and no critical dimension below `1`.

## Dimensions

| Dimension | What it checks | Typical evidence |
| --- | --- | --- |
| Spec alignment | Behavior matches `.specify/specs` and ADR intent | spec links, ADR links, code references |
| Test evidence | Unit/integration coverage for changed behavior | `npm run test -- ...` output in review artifact |
| Review evidence | Independent review artifact exists and is specific | `docs/review/bead-XXXX-*.md` |
| Documentation | Operator/developer docs updated for behavior change | docs diff + references |
| Security posture | AuthN/AuthZ, tenant boundaries, secrets, safety constraints | tests + threat/risk notes |
| Performance impact | Latency/throughput/resource impact assessed | benchmark notes or explicit N/A rationale |
| Rollback readiness | Clear rollback trigger and recovery path | runbook section / rollback notes |

## Required closeout checklist

1. Bead has owner and claim metadata while in progress.
2. At least one review artifact exists under `docs/review/`.
3. Verification commands and outcomes are recorded.
4. Rollback trigger is captured in bead metadata or linked runbook.
5. Weekly and metadata audits are regenerated.

## Application across all beads

- The scorecard is applied portfolio-wide through two mandatory artifacts:
  - `docs/governance/weekly-pe-audit.md` (cadence + sequencing + status visibility)
  - `docs/governance/bead-metadata-audit.md` (owner/close criteria/rollback metadata enforcement)
- Every bead close updates these artifacts in the same or immediately-following commit.

## Template snippet for bead reviews

```md
## Acceptance Scorecard

| Dimension | Score (0-3) | Evidence |
| --- | --- | --- |
| Spec alignment |  |  |
| Test evidence |  |  |
| Review evidence |  |  |
| Documentation |  |  |
| Security posture |  |  |
| Performance impact |  |  |
| Rollback readiness |  |  |

Total: /21
Decision: pass/fail
```
