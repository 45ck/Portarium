# Cockpit Operator Onboarding Playbooks v1

## Purpose

Define the minimum enablement artifact set required before a controlled
operator pilot can run Cockpit-driven Portarium workflows without hands-on
support.

This specification does not define Cockpit UI implementation. It defines what
operators must be able to learn, execute, and verify from documentation and
existing governance surfaces.

## Scope

The required playbook is
[docs/how-to/operate-cockpit-governed-workflows.md](../../docs/how-to/operate-cockpit-governed-workflows.md).

It must cover:

- first-time operator readiness checks
- first controlled Run path from Cockpit
- normal-run playbooks for approve, deny, request changes, handoff, and
  escalation
- incident playbooks for stuck Runs, broken resumes, plugin disable, and Policy
  rollback
- guidance on when to trust the system and when to inspect deeply
- pilot exit criteria that separate operator enablement gaps from Cockpit UI
  implementation defects

## Required Semantics

The playbook must use the canonical terms from
[docs/glossary.md](../../docs/glossary.md), including Run, Workflow, Action,
Plan, Policy, Approval Gate, Evidence Artifact, Evidence Log, Cockpit
Extension, Workforce Queue, Work Item, Execution Tier, and Workspace.

Every non-routine operator path must preserve the authority model from
[operator-interaction-model-v1.md](./operator-interaction-model-v1.md):

- the actor knows which governance function they are exercising
- the action distinguishes current-Run effect from future-Policy effect
- handoff and escalation preserve context continuity
- emergency plugin disable and Policy rollback use explicit authority paths
- trust calibration is based on evidence, Policy, reversibility, blast radius,
  and track record rather than blanket trust or blanket distrust

## Acceptance

- A new operator can follow the guide to start, inspect, and resolve a pilot
  governed workflow from Cockpit.
- An approver can use the guide to approve, deny, or request changes without
  changing future Policy by accident.
- An operator can hand off or escalate a Run with enough context for the next
  accountable function.
- A platform admin or policy owner can follow the incident playbooks to disable
  an unsafe plugin or roll back a Policy through governed control paths.
- The guide references existing trust calibration and pilot readiness material
  instead of creating a separate governance model.

## Traceability Links

- [docs/how-to/operate-cockpit-governed-workflows.md](../../docs/how-to/operate-cockpit-governed-workflows.md)
- [docs/how-to/run-operator-trust-calibration.md](../../docs/how-to/run-operator-trust-calibration.md)
- [docs/internal/governance/pilot-readiness-sequence.md](../../docs/internal/governance/pilot-readiness-sequence.md)
- [operator-interaction-model-v1.md](./operator-interaction-model-v1.md)
- [operator-plugin-governance-controls-v1.md](./operator-plugin-governance-controls-v1.md)
- [policy-change-workflow-v1.md](./policy-change-workflow-v1.md)
