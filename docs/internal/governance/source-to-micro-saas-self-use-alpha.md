# Source-to-Micro-SaaS Self-Use Alpha

Status: alpha runbook and fixture pack for `bead-1102`.

This runbook makes the first self-use alpha concrete for the chosen
`source-to-micro-saas-builder` workflow. It is intentionally narrow: one
recurring internal Project, one builder owner, one evidence ledger, and explicit
rollback and stop-using-it capture.

## Workflow

- `workflowId`: `source-to-micro-saas-builder`
- `projectTypeId`: `micro-saas-agent-stack`
- `Project`: `project-self-use-alpha-source-to-micro-saas`
- `Workspace`: `workspace-portarium-internal`
- readiness label: `self-use`
- production claim: `self-use`
- recurrence: weekly, at least three Runs across at least seven calendar days

The useful outcome is a governed source-to-micro-SaaS Artifact package accepted
for builder use. A package can be a cited research dossier plus backlog, a
bounded implementation slice, QA evidence, release notes, rollback notes, or a
rejected package with useful rationale and recovery path.

## Required Artifacts

Each alpha cycle records these Artifacts or links to existing immutable
Evidence Artifacts:

| Artifact                           | Evidence expectation                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Project brief                      | Objective, audience, constraints, quality bar, taste notes, non-goals, and acceptance thresholds.                       |
| Research dossier                   | Source Snapshots, cited claims, freshness, confidence, claim boundaries, conflicts, and open questions.                 |
| Opportunity brief                  | Problem hypothesis, target user, integration feasibility, non-goals, and acceptance criteria.                           |
| Implementation or backlog Artifact | Bounded spec, Work Item list, code change, or handoff package linked to the dossier.                                    |
| QA or release evidence             | Focused test output, typecheck or dependency-cruiser status when feasible, review notes, and release or rollback notes. |
| Usefulness scorecard               | Baseline and pilot metrics using the stable names from `governed-pilot-usefulness-scorecard-v1`.                        |

## Evidence Events

The alpha must not record only successful Runs. Each Run ledger must capture
these event classes when they occur:

| Event kind        | What to record                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `operator-effort` | Active operator minutes for start, steering, review, approval, fixing, and closeout.                                  |
| `exception`       | Denial, request-changes, blocked Run, missing evidence, or Policy exception.                                          |
| `rollback-event`  | Trigger, scope, decision, recovery action, Evidence refs, and completion criteria.                                    |
| `failure`         | Failed generation, failed test, incorrect Artifact, missing source, stale source, tool error, or operator rejection.  |
| `manual-fallback` | Work moved outside Portarium because the governed path was blocked, too slow, wrong, unsafe, or not worth continuing. |
| `stop-using-it`   | A bounded moment where the builder stopped using the workflow, including reason and restart condition.                |
| `useful-output`   | Accepted Artifact package, rejected package with rationale, or package carried forward into builder work.             |
| `artifact-review` | Accept, reject, request-changes, or wrong-direction review signal with Evidence refs and rationale.                   |

## Rollback Protocol

Use the smallest rollback level that restores operator trust:

| Level | Scope               | Actions                                                                                                                                                                   |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1    | Run-level revert    | Stop the Run, reject or supersede generated Artifacts, restore prior branch or file state, and record Evidence refs.                                                      |
| L2    | Workflow pause      | Pause recurrence, route remaining work as Manual-only Human Tasks, and create follow-up Beads for missing Policy, evidence, or tooling.                                   |
| L3    | Stop self-use claim | Downgrade the next truthful readiness label to `pilot-candidate` or `demo-only`, publish a concern or failure report, and restart only after evidence-backed remediation. |

Rollback triggers include duplicate externally-effectful Actions, unsafe Action
or Policy violation escapes, uncited material claims driving implementation or
approval context, operator minutes increasing without accepted quality or KPI
tradeoff, repeated exception fingerprints without remediation, or the builder
stopping real use during the pilot window.

Rollback is complete only when the affected Run is stopped, corrected, or moved
to Manual-only; Artifact status reflects accepted, rejected, superseded, or
rolled back; the Evidence Log records trigger, scope, operator decision, and
recovery action; and follow-up Beads exist for unresolved defects.

## Run Ledger

For each Run, append a ledger entry with:

- `runId`
- `startedAtIso` and `endedAtIso`
- `operatorMinutes`
- `approvalGateRefs`
- `artifactRefs`
- `evidenceRefs`
- `usefulOutcomeAccepted`
- `exceptionEvents`
- `rollbackEvents`
- `manualFallbackEvents`
- `stopUsingItEvents`
- `followUpBeadRefs`

The canonical fixture for this runbook is
`docs/internal/governance/source-to-micro-saas-self-use-alpha.json`. Validate it
with:

```bash
node scripts/governance/validate-self-use-alpha.mjs
```

## Follow-Up Rule

Every Concern or Failure metric, unresolved rollback trigger, repeated exception
fingerprint, or stop-using-it event creates a follow-up Bead before any broader
public claim is made.
