# OpenClaw Integration Rollback Runbook

**Bead:** bead-0803
**Status:** accepted
**Reviewed:** 2026-02-23

This runbook defines the rollback procedure for the OpenClaw full integration. Each
trigger type has its own recovery path. Perform the acceptance check at the end of
each procedure before closing the incident.

---

## Scope of a Rollback

A rollback can be scoped to one of three levels:

| Level                     | Scope                                              | Effect                                                  |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| **L1 — Feature disable**  | Toggle OpenClaw gateway off at config              | Machines stay registered; no runs dispatched to gateway |
| **L2 — Endpoint removal** | Remove or gate gateway-facing routes               | API clients receive 404 or 503; no data loss            |
| **L3 — Full teardown**    | Deprovision workspace gateways, revoke credentials | Complete removal; re-provisioning required to restore   |

Default rollback for all triggers is L1 unless stated otherwise.

---

## Rollback Trigger 1 — Token Exposure (Critical)

**Condition:** Gateway bearer token discovered in any HTTP response body, log line, or
audit record.

**Severity:** Critical — immediate rollback, no grace period.

**Steps:**

1. Rotate the compromised bearer token in the credential store immediately (do not
   wait for rollback to complete).
2. Trigger L2 rollback: disable all gateway-facing endpoints at the load-balancer
   level.
3. Audit all log aggregation destinations (Loki, CloudWatch, Datadog) for the token
   string; purge any log entries containing it.
4. Review `toMachineApiView()` in `src/presentation/ops-cockpit/types.machines.ts`
   to confirm the `authConfig` strip is applied on all code paths.
5. Open a security incident; attach evidence of exposure scope.
6. Fix the root cause (missing strip call, inadvertent logging).
7. Re-deploy with fix and verify ADR-0099 contract tests pass before L2 is restored.

**Acceptance:** `control-plane-handler.machine-agent.contract.test.ts` passes with
authConfig-stripping assertions green; no token string present in sampled log lines
for 30 minutes after re-deploy.

---

## Rollback Trigger 2 — Cross-Workspace Data Access (Critical)

**Condition:** A request carrying `tenantId=A` accesses or modifies a resource owned
by `tenantId=B`, confirmed in live traffic or audit logs.

**Severity:** Critical — immediate rollback, no grace period.

**Steps:**

1. Trigger L2 rollback: disable machine/agent registry and gateway-invocation routes.
2. Identify the code path that allowed the bypass (missing `workspaceId` guard, wrong
   composite key construction, etc.).
3. Audit recent operations for the affected workspace pair; determine the blast radius
   (which resources were touched, which tenants are affected).
4. Notify affected tenants per data-breach notification policy.
5. Fix the guard or key construction bug.
6. Add or tighten the cross-workspace rejection test in
   `control-plane-handler.machine-agent.contract.test.ts`.
7. Re-deploy with fix; verify isolation spec
   (`openclaw-gateway-workspace-isolation-v1.md`) invariants hold against the test
   suite.

**Acceptance:** Cross-workspace rejection tests pass; audit of a 30-minute traffic
sample shows no cross-tenant row reads.

---

## Rollback Trigger 3 — PolicyBlocked Bypass (Critical)

**Condition:** A Dangerous-category tool executes with an execution tier below
ManualOnly (i.e., `isOpenClawToolAllowedAtTierV1` returned `true` when it should
have returned `false`).

**Severity:** Critical — immediate rollback, no grace period.

**Steps:**

1. Trigger L1 rollback: disable tool invocation route (`/tools/invoke`) at the
   gateway level (set `OPENCLAW_TOOL_INVOKE_ENABLED=false` or equivalent config).
2. Identify the specific tool name that bypassed the policy and the run that
   triggered it.
3. Audit the classification regex patterns in
   `src/domain/machines/openclaw-tool-blast-radius-v1.ts` for the gap.
4. Add a regression test for the specific tool name to
   `openclaw-tool-blast-radius-v1.test.ts`.
5. Fix the pattern or precedence logic.
6. Re-deploy; confirm the tool is now classified as Dangerous and blocked below
   ManualOnly tier.

**Acceptance:** `openclaw-tool-blast-radius-v1.test.ts` passes with a regression test
for the offending tool name; a dry-run invocation of the tool at Auto tier returns
`PolicyBlocked`.

---

## Rollback Trigger 4 — Release Gate Contract Test Failure (High)

**Condition:** Any test in `src/infrastructure/adapters/openclaw-release-gate.test.ts`
fails on a production candidate build.

**Severity:** High — rollback unless a hotfix is landed and verified within 2 hours.

**Steps:**

1. Identify the failing test and the missing or corrupt artifact it checks.
2. If the artifact is a missing file: restore or recreate the file from the bead
   implementation.
3. If the artifact is a content check failure: review the relevant governance or spec
   document for the missing section.
4. Land a hotfix commit; re-run `npm run ci:pr` to confirm all tests pass.
5. If the fix cannot be confirmed within 2 hours, trigger L1 rollback and re-open
   bead-0803.

**Acceptance:** `openclaw-release-gate.test.ts` exits with all checks green on the
production candidate commit.

---

## Rollback Trigger 5 — Drift Sync Consecutive Failures (Medium)

**Condition:** The `openclaw-drift-sync-pipeline` emits consecutive failures for more
than 5 minutes without soft-fail containment (i.e., exceptions propagate to callers
rather than resolving to `BridgeOperationResult { ok: false }`).

**Severity:** Medium — rollback if no fix is in place within 1 hour.

**Steps:**

1. Inspect pipeline logs: look for uncaught exceptions or unhandled promise rejections
   from `openclaw-drift-sync-pipeline.ts`.
2. If the pipeline is throwing instead of returning a failure result, patch the
   catch block to resolve to `{ ok: false, reason: <error message> }`.
3. If the underlying gateway endpoint is unreachable: verify the gateway deployment
   for the affected workspace is healthy; check network policy (ADR-0072).
4. If no fix within 1 hour: trigger L1 rollback (disable drift sync cron/loop) to
   prevent runaway retries.

**Acceptance:** Pipeline emits `BridgeOperationResult { ok: false }` on gateway
unavailability; no uncaught exceptions in a 10-minute soak test.

---

## Re-Provisioning After Rollback

After an L2 or L3 rollback is resolved:

1. Follow `docs/internal/governance/openclaw-workspace-gateway-provisioning-runbook.md` to
   re-provision the workspace Gateway.
2. Re-run `npm run ci:pr` on the fixed candidate.
3. Verify all six release gate controls from `docs/internal/governance/openclaw-release-gate.md`
   are green.
4. Tag the re-deploy commit with the incident ticket reference.

---

## Contacts and Escalation

- On-call runbook owner: follow the standard escalation path in the platform incident
  policy.
- For Trigger 1 (token exposure) or Trigger 2 (cross-workspace): escalate to the
  security team immediately in parallel with the rollback steps.
