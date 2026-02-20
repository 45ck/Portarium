# Bead Stop-Loss Thresholds

This document defines mandatory stop conditions for an active delivery cycle.

## Trigger conditions

Halt the cycle when any condition below is met:

1. `riskScore >= 8` for an in-flight bead or stream.
2. `ci:pr` fails for 2 consecutive attempts on the same stream without a fix-forward plan.
3. `P0` bead blocked by unresolved dependency for more than 1 working day.
4. Open decision debt:
   - `>= 3` unresolved architecture/security decisions, or
   - any unresolved decision directly impacting tenant isolation, safety, or evidence integrity.
5. Governance drift:
   - missing owner/close criteria/rollback metadata on any active bead, or
   - missing review artifact for a bead marked ready-to-close.

## Required halt actions

1. Freeze new bead starts (no new claims except remediation beads).
2. Promote blocker triage to principal engineer and stream leads.
3. Create remediation bead(s) with explicit exit criteria.
4. Publish status update in the cycle log including:
   - trigger condition
   - impacted beads/streams
   - owner and ETA for unblocking
5. Resume only after stop condition is cleared and validated in audits/tests.

## Escalation matrix

| Condition type                | Primary owner      | Escalation target                       |
| ----------------------------- | ------------------ | --------------------------------------- |
| CI/Gate failures              | Stream lead        | Principal engineer                      |
| Dependency deadlock           | Principal engineer | Product/architecture owner              |
| Security/safety decision debt | Security lead      | Principal engineer + architecture owner |
| Governance metadata drift     | Governance lead    | Principal engineer                      |

## Enforcement points

- Daily execution review uses `docs/governance/weekly-pe-audit.md` and `docs/governance/bead-metadata-audit.md`.
- Stop-loss checks are mandatory before marking any phase gate as complete.
- Bead closure is blocked when a stop-loss condition remains active for that stream.
