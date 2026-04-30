# Pilot Readiness Sequence

Status: sequencing note for bead-1056.

This note turns pilot readiness into a dependency map. It does not make broad pilot research a release blocker. Core remains the governed agent loop: agents propose Actions, Portarium applies Policy and Evidence, Cockpit lets operators approve or steer, and tests prove the path.

## Readiness Goal

A controlled operator pilot is ready when Portarium can show:

- the agent governance loop works under normal and degraded conditions
- human decisions have enough context to be meaningful
- operators know which authority they are using
- Policy changes are permissioned, versioned, and reversible
- evidence, telemetry, privacy, and retention rules are explicit
- onboarding and recovery playbooks exist for the pilot workflow

## Core Sequence

| Step | Bead        | Why it is in sequence                                                                 |
| ---- | ----------- | ------------------------------------------------------------------------------------- |
| 1    | `bead-1057` | Defines how usefulness is measured against a baseline instead of demo-only success.   |
| 2    | `bead-1058` | Measures trust calibration and approval fatigue before locking evidence packet rules. |
| 3    | `bead-1059` | Proves recovery for pending approvals and governed resume paths.                      |
| 4    | `bead-1060` | Gives permissioned operators a Policy authoring and simulation surface.               |
| 5    | `bead-1061` | Defines versioned Policy change workflow, expiry, approval, and rollback.             |
| 6    | `bead-1063` | Defines telemetry, Evidence Artifact, privacy, retention, and legal-hold rules.       |
| 7    | `bead-1065` | Prepares onboarding and incident playbooks for controlled operator use.               |
| 8    | `bead-1066` | Runs the first controlled operator-team workflow.                                     |
| 9    | `bead-1067` | Produces the pilot readiness gate and go/no-go decision.                              |

## Dependency Into Cockpit Core

Some Cockpit contracts depend on this sequence because they would otherwise guess at operator behaviour:

- `bead-1058` unblocks `bead-1075`, the evidence sufficiency packet.
- `bead-1074` defines authority and accountability before `bead-1076` expands intervention controls.
- `bead-1075` then unblocks `bead-1078`, `bead-1079`, and the deeper approval review model.

The bead-1074 artifact is the authority and accountability contract in `.specify/specs/operator-interaction-model-v1.md`.
The bead-1058 eval is runnable with `node node_modules/vitest/vitest.mjs run scripts/integration/scenario-operator-trust-calibration.test.ts`.
The bead-1075 artifact is the shared packet contract in `.specify/specs/decision-context-packet-v1.md`.

## Not Core For This Sequence

The following remain future work unless a pilot specifically selects them:

- Growth Studio and other showcase dashboards
- generated operator cards from arbitrary plugins
- prompt-language governed coding workflows
- multi-project venture portfolio surfaces
- demo-machine media automation

These can reuse the same governance contracts later, but they should not define the pilot readiness model.

## Closure Signal

This epic is closed when the remaining gaps are explicit dependent Beads with a clear order. The dependent Beads own implementation, experiments, and review evidence.
