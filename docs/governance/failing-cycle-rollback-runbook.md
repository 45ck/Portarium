# Failing Cycle Rollback Runbook

This runbook defines how to stop, roll back, and communicate when a delivery
cycle becomes unsafe to continue.

## Objective

- Contain blast radius quickly.
- Restore last known good state.
- Preserve auditability for post-incident review.

## Ownership

| Role                                    | Responsibility                                   |
| --------------------------------------- | ------------------------------------------------ |
| Incident Commander (Principal Engineer) | Declares rollback mode and coordinates decisions |
| API Lead                                | Control-plane/API rollback actions               |
| Infrastructure Lead                     | Runtime/platform rollback actions                |
| Data and Evidence Lead                  | Database/evidence integrity and cleanup actions  |
| Security Lead                           | Credential revocation and rotation actions       |
| Communications Owner                    | Stakeholder updates and status cadence           |

## Freeze Scope

Trigger rollback mode when one or more conditions are met:

- `npm run ci:pr` fails in critical areas and cannot be resolved within planned window.
- Production/staging reliability or integrity regressions are detected.
- Security or tenancy isolation risk is identified.
- Evidence chain integrity is uncertain.

Once rollback mode is declared:

1. Freeze new feature merges.
2. Freeze new bead claims for implementation work (allow only rollback and incident beads).
3. Freeze environment promotions (dev -> staging -> prod).
4. Restrict deployment permissions to rollback owners.

## Rollback Scope Levels

| Level | Scope                                                   | Typical use                                          |
| ----- | ------------------------------------------------------- | ---------------------------------------------------- |
| L1    | Code/config rollback only                               | Regressions limited to app logic or config           |
| L2    | Code/config + schema/data rollback                      | Migration/projection or data correctness regressions |
| L3    | Full incident rollback (code/data/evidence/credentials) | Security, integrity, or cross-tenant risk            |

## Procedure

### Step 1: Declare rollback mode

- Incident Commander posts a rollback declaration.
- Record timestamp, trigger reason, and selected rollback scope level.

### Step 2: Identify rollback target

- Choose the last known good commit/build/deployment.
- Confirm associated migration state and environment configuration.
- Confirm evidence and event stream cutover point.

### Step 3: Execute technical rollback

#### 3a) Application and API rollback

- Revert or redeploy control-plane and worker runtime to target version.
- Confirm OpenAPI/runtime behavior parity for critical endpoints.

#### 3b) Infrastructure rollback

- Revert platform/config drift introduced in failing cycle.
- Validate health endpoints and worker/runtime startup.

#### 3c) Data rollback and cleanup

- Revert unsafe schema or projection changes where required.
- Rebuild or repair derived/read-model tables if needed.
- Verify tenant boundaries and idempotency invariants.

#### 3d) Evidence pipeline actions

- Preserve append-only evidence history; do not rewrite immutable records.
- Mark affected runs/entries with incident correlation metadata.
- Validate hash-chain continuity after rollback actions.

#### 3e) Credential and security cleanup

- Revoke credentials exposed or potentially impacted during failing cycle.
- Rotate impacted keys/tokens/secrets.
- Re-verify least-privilege and tenant scoping controls.

### Step 3 Checklist: Mandatory Cleanup Validation

| Cleanup area           | Required action set                                                                | Owner                  | Evidence to capture                                      |
| ---------------------- | ---------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------- |
| Data rollback/cleanup  | Revert unsafe schema/data changes; rebuild projections; re-verify tenant isolation | Data and Evidence Lead | Migration/projection repair notes; tenant-isolation test |
| Evidence rollback safe | Preserve append-only log; annotate impacted records; verify hash-chain continuity  | Data and Evidence Lead | Evidence chain verification output and incident links    |
| Credential hygiene     | Revoke and rotate impacted credentials; re-verify scoped permissions               | Security Lead          | Credential rotation log and scope verification summary   |

### Step 4: Verification gates

- Run mandatory checks:
  - `npm run ci:pr` (or capture known baseline blocker explicitly)
  - service health checks
  - critical workflow smoke checks
  - evidence and event emission checks
- Record verification evidence in `docs/review/` and incident notes.

### Step 5: Controlled unfreeze

Unfreeze only when all of the following are true:

- rollback target is stable;
- critical checks pass or accepted risk is signed off;
- ownership is re-established for next-cycle work;
- communication updates are sent.

## Communication Templates

### Template A: Rollback declared

Subject: `Portarium delivery rollback declared - <date/time UTC>`

Body:

```
Status: Rollback mode active.
Trigger: <brief trigger summary>.
Scope level: <L1|L2|L3>.
Freeze scope: feature merges and environment promotions paused.
Current owner: <Incident Commander>.
Next update: <time UTC>.
```

### Template B: Rollback execution update

Subject: `Portarium rollback in progress - <date/time UTC>`

Body:

```
Rollback target: <commit/build/deployment>.
Actions completed:
- <item 1>
- <item 2>
Actions in progress:
- <item 1>
Risks:
- <item 1>
Next update: <time UTC>.
```

### Template C: Recovery and unfreeze notice

Subject: `Portarium rollback complete - controlled unfreeze`

Body:

```
Rollback completed at: <time UTC>.
Verification status: <summary>.
Remaining risks/follow-ups:
- <item 1>
- <item 2>
Unfreeze scope:
- <what is unblocked>
Post-incident review owner: <name/role>.
```

## Post-Rollback Deliverables

- Incident summary with root cause and timeline.
- Bead-level follow-up list for corrective actions.
- Updated safeguards/runbooks if control gaps were found.
