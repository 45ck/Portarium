# CI cost and delivery

Keep necessary verification and ship useful changes. Reduce redundant candidates
and repeated work; a smaller bill is not evidence of adequate QA.

## Repository workflow

Use the existing Beads claim and integration workflow. Publish required ownership claims promptly; batch implementation fixups into a tested candidate. Run `npm run ci:pr` before declaring work complete; focused tests do not replace that gate.

## Choose checks by the changed risk

| Change          | First check                                                         | Required follow-through                                                                             |
| --------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Documentation   | `npm run docs:lint`                                                 | Review links, spelling and layout; the required `npm run ci:pr` gate still applies.                 |
| Implementation  | `npm run test -- <test-file>` while iterating; then `npm run ci:pr` | Select an existing affected test file; retain contract, architecture, migration and security gates. |
| Browser changes | `npm run test:e2e:smoke` plus the applicable browser QA evidence    | Preserve screenshots, traces and the existing user-flow acceptance requirements.                    |

Focused checks shorten diagnosis. They do not replace existing merge, release,
security, compatibility, coverage or acceptance requirements. Shared runtime,
dependency, test-runner or workflow changes need the broader applicable gates.

## Publish a coherent candidate

1. Inspect current branches and open PRs. Assign one integrating writer for shared
   CI, configuration and lockfiles; preserve other agents' work.
2. Finish one reviewable increment, run its focused checks and required local gate,
   then publish together. Keep ownership claims timely where the repository requires them.
3. Read the actual remote result for that commit. On failure, capture the first
   relevant error, diagnose locally where possible, and retry the smallest failed
   job set only when a fix or transient-failure explanation warrants it.
4. Request a preview or manual heavy run when someone needs that result. Reuse
   valid evidence for an unchanged candidate; do not poll by dispatching workflows.
5. Record commit/PR, check scope, commands, outcomes, run links and retry reason in
   the existing handoff or change record. Keep blocked checks and checks not run explicit.

## CI/CD warnings

> [!WARNING]
> The PR pipeline includes Domain Atlas, the full PR gate and dependent mutation tests. A repeat of the PR job can also repeat dependent work. Diagnose the failing stage before requesting another run.

A rerun uses the original revision, not a newer commit. Publish a correction once
and inspect its new run; retry the old job only for a diagnosed transient failure
on that unchanged revision. GitHub can repeat dependent jobs when a failed job is
rerun. A cancelled or previously green run is not proof about a changed candidate. Do not add `[skip ci]`,
disable required jobs, lower thresholds or use forced green results as a cost control.
Path-filter changes require coverage proof and compatible required-check behaviour.

The existing nightly, deployment, infrastructure and security workflows keep their own triggers and acceptance requirements. Do not use this guide to bypass Beads, an approval gate or `npm run ci:pr`.

## Measure the outcome

Use the existing run/deployment records: accepted change, commit, run attempt, job
duration, outcome and retry reason. Compare runner minutes, elapsed delivery time
and failed/repeated work per accepted change. Keep provider CPU usage, credits and
actual invoices separate; job counts and elapsed wall time alone are not billed cost.
This guidance adds no schedule, workflow, dependency or paid service.

References: [GitHub job reruns](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
and [skipped workflow checks](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs).
