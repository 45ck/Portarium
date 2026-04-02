# Iteration 2 Experiment Plan

## Summary

Iteration 1 proved that Portarium can govern a live OpenClaw workflow and that a longer
micro-SaaS rehearsal can complete with recorded evidence. Iteration 2 should stop treating the
system like a short demo and start treating it like an operating business.

The next wave should answer four business-scale questions:

1. What happens when approvals sit overnight or across an operator shift?
2. What happens when multiple operators act on the same queue?
3. What happens when multiple governed OpenClaw sessions are active at once?
4. What happens when queue depth, wait time, and runtime duration increase materially?

## Recording Rule

Do not overwrite iteration 1.

- Keep the existing experiment directories, reports, and result bundles unchanged.
- Create new experiment directories for reruns and second attempts.
- Use explicit versioned names such as `growth-studio-openclaw-live-v2` and
  `micro-saas-agent-stack-v2`.
- Each v2 experiment should link back to the earlier run it is extending or re-testing.

## What We Already Know

The repo already has useful lower-level evidence that should drive iteration 2:

- Delayed approval and polling behavior is covered in
  [scenario-overnight-approval.test.ts](../scripts/integration/scenario-overnight-approval.test.ts).
- Isolation between concurrent approvals is covered in
  [scenario-approval-lifecycle.test.ts](../scripts/integration/scenario-approval-lifecycle.test.ts).
- Concurrent multi-tenant pipeline behavior is covered in
  [concurrent-multi-tenant.test.ts](../scripts/load/concurrent-multi-tenant.test.ts).

That means iteration 2 should not repeat those as toy unit checks. It should elevate them into
live business-like experiments with stronger observability and more realistic operator behavior.

## Program

### E2-1: Growth Studio v2 - overnight approval and exact resume

Purpose:
Prove that a governed Growth Studio run can pause for a business-length delay and resume exactly
once after approval.

Scenario:

- OpenClaw proposes several governed writes.
- One approval is intentionally left pending for a long delay window.
- The operator approves after the delay.
- The agent must resume the blocked step, not restart the whole run or duplicate the side effect.

Variants:

- Live-wait variant: agent remains alive and blocked.
- Restart-resume variant: proposal is created, agent process exits, a later recovery path resumes.

Primary assertions:

- Pending approval remains durable across the full delay window.
- Resume latency after decision is measured and stays within a defined threshold.
- Exactly-once execution is preserved after approval.
- Evidence chain is continuous before wait, during wait, and after resume.

Why this matters:
This is the closest test of the "operator was asleep for 8 hours" business case.

### E2-2: Micro-SaaS v2 - operator team handoff

Purpose:
Prove that approvals still behave correctly when the queue is handled by a team instead of one
operator.

Scenario:

- Multiple approvals are created from one micro-SaaS run.
- Operator A approves low-risk draft items.
- Operator B handles higher-risk publish or send decisions.
- One item is denied or marked request-changes while others proceed.

Primary assertions:

- Separation of Duties is preserved when distinct approvers are required.
- One stalled or denied approval does not block unrelated queued work.
- Approval ordering does not corrupt run state when operators act out of order.
- Queue metrics show who approved what, how long it waited, and whether handoff occurred.

Why this matters:
Real businesses do not have one always-awake operator. They have shifts, handoffs, and backlog.

### E2-3: Concurrent sessions - many governed OpenClaw runs at once

Purpose:
Prove that Portarium and the plugin handle several active governed sessions concurrently without
cross-contamination.

Scenario:

- Launch multiple OpenClaw sessions at the same time.
- Each session proposes, waits, resumes, and writes to its own output bundle.
- Approvals are resolved in mixed order.

Primary assertions:

- Approval IDs, evidence, and outputs stay session-scoped.
- A decision for one session never unblocks another session.
- Throughput and latency remain within target thresholds at the chosen concurrency level.
- No duplicate execution occurs when several approvals resolve near-simultaneously.

Why this matters:
This is the real answer to "what if OpenClaw is doing multiple things at once?"

### E2-4: Approval backlog and soak

Purpose:
Measure queueing behavior, escalation, and degradation under sustained pending work.

Scenario:

- Generate a large queue of pending approvals across several sessions or tenants.
- Hold some pending long enough to trigger escalation and expiry paths.
- Keep the system running long enough to expose scheduler or memory issues.

Primary assertions:

- Escalation and expiry happen independently per approval.
- Queue depth, pending age, and expiry counts are recorded over time.
- No duplicate escalation events are emitted.
- Runtime memory and error rate remain bounded during the soak window.

Why this matters:
Short runs can look healthy while the real bottleneck is backlog management.

### E2-5: Toolchain realism redo

Purpose:
Re-run the micro-SaaS path with stronger external-tool realism while preserving safety.

Scenario:

- Keep Portarium as the governor and stub external publish or send effects.
- Use `content-machine` where it is actually runnable.
- Either make `demo-machine` runnable or record an explicit skip with reason.
- Keep the result bundle reproducible from tracked config and preflight logs.

Primary assertions:

- Toolchain preflight fails early and clearly if a required tool is unavailable.
- Tool use is recorded as evidence, not just implied by outputs.
- The experiment report distinguishes "runnable", "stubbed", and "skipped" tools.

Why this matters:
Iteration 1 proved the governed loop; iteration 2 should reduce "worked on this box only" caveats.

## Telemetry Requirements

Iteration 2 should capture these metrics in every run:

- approval count by tier and by session
- pending age p50, p95, and max
- resume latency after approval decision
- blocked duration per agent session
- queue depth over time
- denial, request-changes, escalation, and expiry counts
- duplicate-execution count
- evidence completeness count
- process restart count and successful resume count

## Pass/Fail Logic

Iteration 2 should not be judged by "the run completed".

A run is only a strong success if:

- the governed business loop completes
- the timing and queue evidence is captured
- no cross-session contamination is observed
- the expected approval and resume behavior is confirmed under the selected delay or concurrency
- known warnings are either fixed or explicitly classified as residual risk

A run is a useful failure if:

- it exposes a queueing, ordering, resume, escalation, or observability flaw
- the result bundle captures enough evidence to explain the failure

## Proposed Order

1. `growth-studio-openclaw-live-v2`
   Focus: overnight wait and exact resume.
2. `micro-saas-agent-stack-v2`
   Focus: operator team handoff and queue behavior.
3. `openclaw-concurrent-sessions`
   Focus: multiple simultaneous governed sessions.
4. `approval-backlog-soak`
   Focus: escalation, expiry, and sustained queue pressure.
5. `micro-saas-toolchain-redo`
   Focus: `content-machine` and `demo-machine` realism.

## Known Gaps Before Running

- `bead-1034`: `manual-qa-machine` browser launch instability on this Windows host
- `bead-1036`: OpenClaw plugin path-hint mismatch warning
- `bead-1037`: provider quota and credential preflight
- `bead-1038`: `demo-machine` runnable vs skipped toolchain state
- `bead-1039`: repo-wide `dependency-cruiser` gate break

These do not block experiment design, but they directly affect the quality of iteration 2 evidence.
