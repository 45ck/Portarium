# Portarium Roadmap

This roadmap separates core release work from future product and showcase work.

## Current Focus

The near-term goal is to make the tested agent governance loop reliable:

1. Agents propose actions through the SDK, plugin, or HTTP API.
2. Portarium classifies actions by policy and execution tier.
3. Safe actions run.
4. Risky actions create approvals that are easy to review from Cockpit, including phone-sized web views.
5. Blocked actions do not run.
6. Approved actions execute through a controlled boundary.
7. Evidence and results are recorded.
8. Automated tests prove the path.

## Core Before Release

These are core because Portarium would be unsafe, hard to run, or hard to verify without them.

| Area            | Work                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Security        | Fail-closed hooks, plugin config validation, header sanitization, metrics auth, ownership checks        |
| Verification    | Keep scenario tests proving allowed, approval-required, denied, blocked, retry, and isolation behavior  |
| Release hygiene | SDK publishing, migration runner closeout, green `npm run ci:pr`, gate baseline cleanup                 |
| Operations      | Production startup gates, clear env docs, health/readiness checks, migration commands                   |
| Cockpit         | Reference UI for approvals, policy context, runs, evidence, operator review, and mobile decision review |

## Good First Areas

Good OSS contributions should improve the core loop:

- clearer local setup and troubleshooting
- more focused tests for policy, approval, and evidence behavior
- SDK examples for proposing and waiting on governed actions
- adapter examples that show controlled execution without vendor complexity
- docs that explain agent integration simply
- security hardening items with narrow tests

## Future Work

These are intentionally not release blockers for the core control plane.

### Business Showcases

- Growth Studio
- prospect research agents
- content and outreach agents
- measurement dashboards
- recorded demo walkthroughs

### Product Experience

- mission-control UI convergence
- advanced Cockpit surfaces after the core mobile approval review path is reliable
- multi-project venture dashboards
- policy-to-approval conversion workflows
- advanced operator taste and steering tools

### Research And Pilots

- pilot readiness
- operator trust studies
- approval-fatigue measurement
- delegated autonomy hierarchy
- policy-learning telemetry
- prompt-language governed coding experiments

### Demo And Media Tooling

- demo-machine integration
- weekly autonomy digests
- generated media artifacts
- showcase automation

## Decision Rule

If a task makes the tested agent governance loop safer, more reliable, easier to run, or easier to verify, treat it as core.

If a task makes Portarium broader, flashier, more marketable, or useful for a specific showcase while the core loop already works without it, document it as future work.
