# Cockpit Mission Control Convergence

Status: design direction for bead-1048.

Cockpit is converging from a demo console into the operator surface for governed agent work. The product center stays Portarium-native: agents run elsewhere, Portarium governs their proposed Actions, and Cockpit lets humans observe, approve, steer, and recover that work without reading raw logs.

## Product Shape

Cockpit should answer four operator questions quickly:

1. What is the agent trying to do?
2. What is it allowed to do without me?
3. What decision needs me now?
4. What evidence, policy, and capability context makes that decision safe?

The first-class surfaces are:

- Approvals: decide gated Actions with enough Plan, Policy, Evidence, and capability context.
- Runs: observe governed work, status, timeline, recovery, and next intervention points.
- Policy Studio: change future defaults without confusing them with the current live approval.
- Workforce and capability views: explain which agents, machines, roles, and tools can act.
- Evidence: prove what was proposed, decided, executed, denied, or blocked.

## Core Boundaries

Cockpit is not a separate project management product, business app builder, or showcase-specific dashboard. It is the reference operator UI for the governed agent loop.

Core:

- approval review from desktop and phone-sized layouts
- agent and machine capability visibility
- live and cached state warnings before human decisions
- policy explanation, simulation, and future-default authoring
- run status, evidence, and recovery hooks
- durable operator input: approval, denial, request changes, steering, handoff, and escalation

Future work:

- Growth Studio dashboards
- generated operator cards from arbitrary plugins
- large mission-control theme convergence
- pilot research screens
- business-specific command centers

Those can reuse Cockpit extension points later, but they should not redefine the core operator model.

## Interaction Model

Humans provide intent, taste, and insight. Agents execute detailed work. Portarium governs the boundary between those two responsibilities.

Cockpit must distinguish these operator inputs:

- Approval decision: allow, deny, request changes, or skip a specific gated Action.
- Steering input: redirect, pause, resume, hand off, or narrow an active Run.
- Policy input: change how future Actions in a class are routed.
- Annotation: add context, taste, or observations without changing authority.
- Escalation: require deeper review, another approver, or emergency intervention.

Each input must be attributable and attach to the relevant Run, Approval, Policy change, or Evidence Artifact.

## Review Depth

Fast review is acceptable only when the card shows enough material context. High-risk or irreversible Actions need deeper friction.

Fast triage should show:

- proposed Action
- agent or machine actor
- goal or intent
- systems touched
- Policy result and Execution Tier
- blast radius
- reversibility
- evidence sufficiency
- current recommendation

Deep review is required when:

- the Action is `ManualOnly`
- blast radius crosses external systems, money, credentials, production, or persistence
- evidence is missing or stale
- Separation of Duties blocks the current approver
- the Action expands authority beyond the current Run charter
- the operator requests escalation or more evidence

## Dependency Map

This note unblocks the detailed work rather than replacing it.

- `bead-1050`: define the canonical operator interaction model.
- `bead-1053`: implement launch and steering surfaces for governed Runs.
- `bead-1075`: define the decision context and evidence sufficiency packet.
- `bead-1076`: implement intervention controls for pause, handoff, freeze, and emergency actions.
- `bead-1078`: define structured approval feedback reasons.
- `bead-1079`: define the risk-tiered approval-card contract and triage-to-deep-review escalation.
- `bead-1080` through `bead-1082`: mature policy posture, capability matrix, and approval-to-policy conversion.

## References

- `docs/project-overview.md`
- `.specify/specs/presentation-layer-reference-cockpit-v1.md`
- `.specify/specs/operator-interaction-model-v1.md`
- `docs/internal/ui/cockpit/agent-machine-runtime-design.md`
- `docs/internal/ui/cockpit/governance-policy-design.md`
- `docs/internal/research/mission-control-ui-domain-model.md`
- `docs/internal/adr/0078-agentic-workflow-cockpit-reuse-vs-build-strategy.md`
- `docs/internal/adr/ADR-0118-agent-action-governance.md`
