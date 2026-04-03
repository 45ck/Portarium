# Operator Interaction Model v1

**Status:** Proposed  
**Related Beads:** bead-1048, bead-1050, bead-1056  
**Extends:** [HCI Principles: Autonomy with Ease of Mind](../../docs/internal/engineering-layer/hci-principles.md)

## Purpose

Define the human-agent operating model for Portarium and Cockpit in a near-autonomous system where agents execute most routine work and humans retain meaningful control over goals, boundaries, intervention, and accountability.

This specification treats oversight as a socio-technical control system, not as a personal virtue of an individual reviewer. Effective oversight requires authority, competence, training, evidence access, manageable workload, and clear intervention paths.

## Problem

Portarium already models Approval Gates, Policy, Execution Tiers, Evidence Artifacts, and governed Runs. That is necessary but not sufficient for real operator control.

The missing layer is the operating model that answers:

- how organisations choose their autonomy posture
- which decisions belong to operators, approvers, auditors, policy owners, and domain SMEs
- what evidence and context must be present before a human can intervene meaningfully
- how a human can pause, reroute, deny, hand off, sandbox, or stop governed work
- how the system prevents fake oversight caused by overload, poor context, weak authority, or rubber-stamping

## Human Value in the System

Humans are not retained in the loop because agents are universally incapable. Humans are retained because the work is social, political, risky, and value-laden.

In Portarium, the human contribution is primarily:

- goal judgment
- policy judgment
- risk judgment
- context judgment
- exception handling
- organisational legitimacy
- feedback for system improvement
- accountability for irreversible or high-blast-radius action

Taste remains important where the domain is creative, editorial, product, or brand-sensitive. It should not be treated as the universal reason for human control.

## Scope

- operator oversight modes for Portarium-governed Runs
- delegation hierarchy from organisation policy down to action-level decisions
- governance functions and their mapping to Portarium roles and Cockpit surfaces
- operator inputs such as intent, constraints, taste, steering, approval, override, and audit
- evidence, context, and visibility requirements for meaningful intervention
- workload, calibration, and competence requirements for trusted operation
- control invariants and non-overridable platform boundaries

## Out of Scope

- model training or fine-tuning policy
- connector-specific policy rules
- legal interpretation for any specific jurisdiction
- plugin implementation details already scoped under plugin architecture beads
- replacing existing Execution Tier, Policy, or Approval domain objects

## Required Vocabulary

Use the canonical terms from [docs/glossary.md](../../docs/glossary.md):

- Workspace / Tenant
- Policy
- Execution Tier
- Action
- Approval Gate
- Plan
- Run
- Evidence Artifact
- Evidence Log
- Work Item
- Workforce Member
- Workforce Queue

## Four Oversight Layers

Portarium should treat effective oversight as the composition of four layers. If one layer is weak, the others cannot compensate fully.

### L1 Individual psychology

The operator's own attention, working memory, trust calibration, fatigue state, mental model, and ability to interpret outputs and abstain when unsure.

### L2 Team cognition

The shared mental model across operators, approvers, auditors, domain SMEs, and agents:

- who owns which decision
- what state the Run is in
- what has already been tried
- what remains blocked or risky
- who is expected to act next

### L3 UX and workflow psychology

The control surface, evidence packet, escalation path, interruption pattern, feedback mechanics, and timing of human intervention. Good people cannot compensate indefinitely for a bad approval UX.

### L4 Organisational governance

The role model, Policy ownership, escalation path, monitoring posture, incident handling, decommissioning path, training expectations, and accountability system that make human oversight real rather than nominal.

These four layers can also be read as three psychology levels plus interface:

- individual psychology
- team cognition
- organisational psychology
- UX and workflow design as the layer that makes the other three actionable

## Core Principles

### P1 Organisation sovereignty over autonomy

Portarium must let an organisation decide how much autonomy to delegate, to which agent or workflow, under which rules, with what evidence depth, and with what intervention powers.

### P2 Meaningful human control, not ceremonial review

Oversight is only meaningful when the human has:

- authority to change the outcome
- epistemic access to the relevant facts
- a reversible or escalatable path when uncertain
- enough time and cognitive bandwidth to decide well

### P3 Calm operations over constant vigilance

The target is not permanent human attention. The target is bounded autonomy with calm supervision. Humans should be pulled in for exceptions, ambiguity, high-risk actions, and policy changes, not as universal bottlenecks.

### P4 Accountability follows authority

No actor should be accountable for a decision they were not empowered or informed to make. Every approval, steering action, policy change, override, and non-routine intervention must be attributable and reviewable.

### P5 Domain-specific human judgment

Human judgment is universal. Taste is domain-specific. Creative, brand, product, and editorial workflows may require taste as a first-class input. Finance, compliance, security, and operations workflows more often require verification skill, policy interpretation, and risk judgment.

## Governance Functions

Portarium should distinguish governance functions even where current RBAC roles are coarser.

| Function | Main responsibility | Typical Portarium role today | Notes |
| --- | --- | --- | --- |
| Policy owner | Defines allowed autonomy, thresholds, prohibitions, and change workflow | `admin` plus future permission slice | Not every admin should be able to weaken policy |
| Operator | Launches, steers, hands off, pauses, resumes, and monitors governed work | `operator` | Focused on flow, not final authorization |
| Approver | Authorizes risky or irreversible actions | `approver` | Must have authority and sufficient evidence |
| Auditor | Reconstructs and evaluates what happened | `auditor` | Read-only, evidence-first posture |
| Domain SME | Verifies substantive correctness in specialised areas | current role may vary | Can be layered on top of approver or operator |
| Platform admin | Manages platform identity, integrations, tenancy, and operational controls | `admin` | Infrastructure and lifecycle authority |

The system must allow a single person to hold multiple functions in small teams, but the model must not assume that is always safe or desirable.

## Oversight Modes

Human control is not one action. Portarium must model at least these distinct modes:

1. **Goal-setting**: define intended outcome, constraints, budget, and boundary conditions before a Run starts.
2. **Steering**: redirect the plan mid-run without taking over manual execution of every step.
3. **Approval**: allow, deny, request changes, or defer a proposed Action or policy change.
4. **Verification**: determine whether the result is correct, sufficient, or fit for release or downstream use.
5. **Exception handling**: intervene when the system is uncertain, off-policy, degraded, or blocked.
6. **Post-hoc audit**: review evidence and improve Policy, prompts, tests, or routing after the fact.

Cockpit must distinguish these modes in data model, UI state, permissions, and evidence.

## Human Role Across the Lifecycle

### S1 Initial setup

Humans define:

- what the agent is allowed to do
- which Actions are `Auto`, `Assisted`, `Human-approve`, or `Manual-only`
- what evidence is required before approval
- what role gates exist
- what counts as destructive, persistent, irreversible, or high-blast-radius

This is organisational judgment encoded into the system.

### S2 Runtime triage

Humans perform:

- rapid risk sorting
- ambiguity resolution
- contextual judgment
- exception handling
- denial with explanation
- escalation when the case exceeds their authority

### S3 Feedback after rejection or failure

Humans should be able to classify why an intervention happened, so that the system can improve rather than just accumulate denials.

### S4 Maintenance

Humans monitor:

- drift in approval quality
- approval fatigue
- poor Policy thresholds
- repetitive false positives
- repetitive false negatives
- changing business rules
- connector posture and capability changes
- incidents and near misses

## Layered Control Hierarchy

Autonomy configuration must be layered. Lower scopes may tighten constraints by default. Lower scopes must not weaken higher-scope hard limits without an explicit approved override path.

### C1 Platform baseline

Non-overridable invariants controlled by Portarium platform design:

- deny-by-default for unknown or unclassified risky actions
- attributable actor identity for every command and intervention
- no cross-tenant evidence or state leakage
- continuous Evidence Log integrity
- no plugin or generated UI path may bypass Policy, Approval, or evidence recording

### C2 Organisation / Tenant autonomy profile

Tenant-wide posture for:

- permitted agent runtimes and model families
- allowed connector and Action classes
- default Execution Tier posture
- workspace-level visibility and retention limits
- break-glass availability and approval rules
- default notification and escalation posture

### C3 Workspace profile

Workspace-specific tailoring for:

- local Policy variants
- business hours and coverage rules
- budget limits
- data sensitivity handling
- connector allowances
- operator and approver queue design

### C4 Role and queue configuration

Authority, coverage, delegation, and workload distribution across:

- operators
- approvers
- auditors
- specialised queues
- backup and after-hours coverage

### C5 Run charter

A Run-specific declaration of:

- intent and success condition
- scope boundary
- allowed tool families
- expected budget and time window
- required evidence depth
- escalation conditions

### C6 Action-level decision

The final execution decision for a proposed Action based on:

- Policy
- Execution Tier
- blast radius
- reversibility
- current budget and compliance state
- operator or approver intervention

## Operator Inputs

Portarium should treat human input as typed governance signals, not generic comments.

| Input type | Meaning | Typical attachment |
| --- | --- | --- |
| Intent | Desired outcome and constraints | Run, Plan |
| Constraint | Hard boundary or forbidden path | Run, Policy, Approval |
| Taste | Subjective quality bar for creative or strategic work | Plan, Artifact review |
| Steering | Mid-run redirect without replacing the agent | Run |
| Approval decision | Approve, deny, request changes, defer | Approval Gate, policy change |
| Override | Exceptional deviation from normal rule path | Policy change, Run, Action |
| Escalation | Route to another person, queue, or authority level | Approval, Run |
| Audit annotation | Post-hoc observation tied to evidence | Evidence Artifact, Run |

Free-text notes are allowed, but the control plane should preserve the semantic type of the human intervention.

## Meaningful Control Requirements

### R1 Authority and intervention power

The system must support bounded but real human intervention, including:

- pause
- resume
- deny
- request changes
- reroute
- hand off
- escalate
- freeze
- sandbox for further review
- emergency disable where available

Where rollback or compensation is possible, the system must surface that path explicitly rather than treating all denials as equal.

### R2 Epistemic access

Before a human is asked to decide, the system must provide enough context to make that decision without reconstructing the Run from raw logs.

Minimum context packet:

- declared goal
- scope boundary
- current step and next-step preview
- proposed Action or policy change
- policy rationale and Execution Tier
- blast radius and reversibility label
- uncertainty, missing evidence, or anomaly flags
- key Evidence Artifact links
- budget and compliance implications
- provenance where upstream agent outputs influenced the current proposal

### R3 Competence and literacy

Meaningful oversight requires both domain competence and AI literacy. Organisations must be able to define who is eligible to:

- approve a class of Action
- steer a governed Run
- change Policy
- perform audit review

Cockpit and Portarium should not assume every operator is a model expert, but they must assume operators need enough literacy to understand failure modes, uncertainty, evidence gaps, and misleading fluency.

### R4 Calibration, not blanket distrust

The desired operator behaviour is appropriate reliance:

- accept correct low-risk outputs when evidence and track record support it
- challenge incorrect, ambiguous, or under-evidenced outputs
- request more evidence or route upward when confidence is unjustified

The system must help operators calibrate trust by Action class, policy class, and track record rather than through a single vague trust score.

### R5 Workload and fatigue limits

Oversight is ineffective if volume, UI density, or timing make good review impossible.

The operating model must assume:

- approval throughput has human limits
- evidence can become too dense
- repetitive approval prompts create automation bias
- prolonged AUTO success can cause inappropriate carryover trust

Cockpit and Policy must therefore support interruption budgets, queue shaping, escalation, and stop-loss behaviour.

### R6 Skill preservation

If humans only click approve and never verify, their review skill will degrade. The operating model must include periodic verification, digest review, audit sampling, or similar mechanisms that preserve critical thinking and substantive judgment over time.

### R6a Team coordination

The system must preserve shared context across multiple humans and agents by making ownership, current state, next expected actor, and prior interventions visible. Handoff should transfer understanding, not just queue assignment.

## Organisation Control Surfaces

Portarium should allow organisations, within platform safety invariants, to control:

- which agent runtimes, model families, and plugins are allowed
- which connectors and Action classes are in scope
- Execution Tier defaults by Action class
- manual-only boundaries
- approval routing and Separation of Duties
- budgets, stop-loss controls, and quiet hours
- evidence depth and review expectations
- generated operator surface allowance
- visibility, retention, and privacy posture for telemetry and Evidence Artifacts
- after-hours coverage and delegation rules

Individuals may personalise views, alerts, and workflow preferences, but individual preference must not silently weaken organisation policy.

## Cockpit Requirements

Cockpit must become the operator surface for this model rather than just an approval inbox.

### UX1 Triage-plus-depth review model

Cockpit should use a two-speed review model:

- **swipe-speed triage** for first-pass sorting, mobile review, and bounded routine approvals
- **control-room depth** for higher-risk, ambiguous, novel, or high-blast-radius review

The approval surface must not force every decision into the same interaction depth.

### R7 Control surfaces

Cockpit must support:

- launch from intent
- live steering
- pause and resume
- reroute and handoff
- approval with rationale
- request-more-evidence
- escalation to another queue or authority
- clear blocked, waiting, degraded, and frozen states

### R8 Mode-aware UI

Cockpit must distinguish when the human is:

- monitoring
- steering
- approving
- auditing
- changing Policy

The same button shape must not hide materially different authority or consequences.

### R9 Calm-state UX

The existing operator state machine in the engineering-layer HCI notes remains authoritative:

- `CALM`
- `INFORMED`
- `ATTENTIVE`
- `ALERT`
- `ACTIVE`
- `RESOLVED`

Normal operation should preserve calm. Escalation should be specific, attributable, and bounded.

### R9a Risk-tiered interaction depth

Low-risk review may stay fast and card-centric. Higher-risk review must add friction and depth proportionate to consequence.

Examples of higher-friction requirements:

- required evidence expansion
- blast-radius summary
- reversibility indicator
- policy-match explanation
- explicit rationale capture
- escalation option
- role-gate locks
- two-step confirmation for irreversible actions where justified

### R10 Approval and steering action set

Approval and steering surfaces must support, where permitted by Policy:

- approve
- deny
- request changes
- lower scope
- escalate
- pause agent
- inspect evidence
- inspect policy match
- inspect blast radius and reversibility
- attach feedback that targets the current Run or future behaviour

### R10a Approval card minimum contract

Every approval or steering card should show, at minimum:

- proposed Action
- goal or intent
- systems touched
- Policy result
- blast radius
- reversibility
- artifacts and evidence
- agent rationale
- prior related Actions or decisions
- allowed actions for the current human role

Where the human denies, modifies, narrows scope, or escalates, the system should require structured reason capture.

### R11 Structured feedback routing

When a human rejects, revises, or intervenes, the system should capture why in a typed way rather than only free text.

Minimum feedback reasons:

- wrong goal
- wrong evidence
- wrong risk level
- wrong execution plan
- missing context
- policy violation
- insufficient quality
- domain-correctness failure

Feedback must also capture where the correction should land:

- current Run only
- reusable playbook or workflow definition
- prompt or agent strategy
- Policy or approval rule
- operator training or runbook

### R12 Handoff and exception context

When work is handed off between humans, or escalated from one function to another, the receiving person must inherit:

- current Run status
- open decision or blocking condition
- key prior interventions
- relevant evidence packet
- next-step options and deadline posture

Handoff without context continuity is a coordination failure, not a neutral transfer.

## Evidence and Accountability Requirements

Every non-routine intervention must record:

- actor identity
- governance function used
- authority source
- rationale
- affected scope
- evidence references consulted
- resulting action or state transition
- timestamp and correlation to Run, Approval Gate, Plan, or Policy version

Every approval, denial, reroute, handoff, override, freeze, and policy change must be explainable after the fact.

## Hard Invariants

The following must not be user-disableable:

1. Evidence continuity and traceability for governed decisions
2. Policy enforcement before external side effects
3. Attributable actor identity for human and agent commands
4. No governance bypass through plugins or generated UI
5. Isolation between tenants and Workspaces
6. Fail-closed handling for unknown, ambiguous, or unsupported high-risk Actions

## Acceptance Signals

- An organisation can choose a bounded autonomy posture without editing code.
- A human reviewer can tell what authority they are exercising and with what consequences.
- A pending decision exposes enough context to decide without raw-log archaeology.
- Steering, approval, verification, exception handling, and audit are distinct in the control model.
- The system supports oversight that is useful at business scale rather than ceremonial at demo scale.
- The model preserves calm operations while keeping intervention power real.

## Open Questions

- Should `policy owner` become a first-class RBAC role or remain a permission slice over `admin` and `approver` capabilities?
- Which intervention actions are reversible versus compensatable across different Port families?
- How much operator-specific personalisation is safe before it weakens team-level consistency?
- What minimum training or readiness evidence should be required before a user can approve high-risk Actions?

## Traceability Links

- [README.md](../../README.md)
- [docs/project-overview.md](../../docs/project-overview.md)
- [docs/explanation/agent-traffic-controller.md](../../docs/explanation/agent-traffic-controller.md)
- [docs/internal/engineering-layer/hci-principles.md](../../docs/internal/engineering-layer/hci-principles.md)
- [.specify/specs/agent-action-governance-lifecycle-v1.md](./agent-action-governance-lifecycle-v1.md)
- [.specify/specs/presentation-layer-reference-cockpit-v1.md](./presentation-layer-reference-cockpit-v1.md)
