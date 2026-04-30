# Operator Interaction Model v1

**Status:** Proposed  
**Related Beads:** bead-1048, bead-1050, bead-1056, bead-1074
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
- a reversible or clearly escalated path when uncertain
- enough time and cognitive bandwidth to decide well

### P3 Calm operations over constant vigilance

The target is not permanent human attention. The target is bounded autonomy with calm supervision. Humans should be pulled in for exceptions, ambiguity, high-risk actions, and policy changes, not as universal bottlenecks.

### P4 Accountability follows authority

No actor should be accountable for a decision they were not empowered or informed to make. Every approval, steering action, policy change, override, and non-routine intervention must be attributable and reviewable.

### P5 Domain-specific human judgment

Human judgment is universal. Taste is domain-specific. Creative, brand, product, and editorial workflows may require taste as a first-class input. Finance, compliance, security, and operations workflows more often require verification skill, policy interpretation, and risk judgment.

## Governance Functions

Portarium should distinguish governance functions even where current RBAC roles are coarser.

| Function       | Main responsibility                                                        | Typical Portarium role today         | Notes                                           |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| Policy owner   | Defines allowed autonomy, thresholds, prohibitions, and change workflow    | `admin` plus future permission slice | Not every admin should be able to weaken policy |
| Operator       | Launches, steers, hands off, pauses, resumes, and monitors governed work   | `operator`                           | Focused on flow, not final authorization        |
| Approver       | Authorizes risky or irreversible actions                                   | `approver`                           | Must have authority and sufficient evidence     |
| Auditor        | Reconstructs and evaluates what happened                                   | `auditor`                            | Read-only, evidence-first posture               |
| Domain SME     | Verifies substantive correctness in specialised areas                      | current role may vary                | Can be layered on top of approver or operator   |
| Platform admin | Manages platform identity, integrations, tenancy, and operational controls | `admin`                              | Infrastructure and lifecycle authority          |

The system must allow a single person to hold multiple functions in small teams, but the model must not assume that is always safe or desirable.

### Authority and accountability contract

Governance functions are responsibilities. RBAC roles are the current coarse implementation handles. Cockpit and the Control Plane must record the function being exercised, not only the user's login role.

Every non-routine intervention must carry:

- `governanceFunction`: one of `operator`, `approver`, `auditor`, `policy-owner`, `domain-sme`, or `platform-admin`
- `authoritySource`: the rule, role, Policy, delegation, Run charter, or emergency procedure that permits the action
- `accountableActorUserId`: the user accountable for this decision
- `target`: the Run, Approval Gate, Plan, Policy, Evidence Artifact, Work Item, Workforce Member, or Workforce Queue affected
- `effect`: `current-run-effect`, `future-policy-effect`, or `context-only`

Accepted authority sources are:

| Authority source         | Meaning                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `workspace-rbac`         | The current Workspace role or permission slice permits the action.   |
| `policy-rule`            | A Policy explicitly permits, requires, or blocks the intervention.   |
| `run-charter`            | The active Run grants bounded steering authority.                    |
| `queue-delegation`       | Workforce Queue coverage or delegation assigns the decision.         |
| `incident-break-glass`   | Emergency procedure temporarily permits a stronger intervention.     |
| `system-invariant`       | A non-overridable platform rule requires or blocks the action.       |
| `policy-change-approval` | A versioned Policy change has passed the required approval workflow. |

### Intervention authority matrix

| Intervention          | Accountable function                      | Current role mapping                       | Minimum authority source                                     | Evidence category      |
| --------------------- | ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ | ---------------------- |
| Monitor or inspect    | Operator or Auditor                       | `admin`, `operator`, `approver`, `auditor` | `workspace-rbac`                                             | none or `System`       |
| Launch from intent    | Operator                                  | `admin`, `operator`                        | `workspace-rbac`, `policy-rule`, `run-charter`               | `Plan`                 |
| Steer or constrain    | Operator                                  | `admin`, `operator`                        | `workspace-rbac`, `policy-rule`, `run-charter`               | `Plan` or `System`     |
| Pause                 | Operator                                  | `admin`, `operator`                        | `workspace-rbac` or `policy-rule`                            | `System`               |
| Resume                | Operator                                  | `admin`, `operator`                        | `workspace-rbac` plus cleared blocker                        | `System`               |
| Request more evidence | Operator, Approver, or Domain SME         | `admin`, `operator`, `approver`            | `workspace-rbac` or `policy-rule`                            | `System` or `Approval` |
| Reroute or escalate   | Operator or Approver                      | `admin`, `operator`, `approver`            | `workspace-rbac`, `queue-delegation`, `policy-rule`          | `System`               |
| Handoff               | Operator                                  | `admin`, `operator`                        | `workspace-rbac` or `queue-delegation`                       | `System`               |
| Approve               | Approver                                  | `admin`, `approver`                        | `workspace-rbac`, `policy-rule`                              | `Approval`             |
| Deny                  | Approver                                  | `admin`, `approver`                        | `workspace-rbac`, `policy-rule`                              | `Approval`             |
| Request changes       | Approver                                  | `admin`, `approver`                        | `workspace-rbac`, `policy-rule`                              | `Approval`             |
| Override              | Policy owner or Platform admin            | `admin` in v1                              | `policy-change-approval` or `incident-break-glass`           | `Policy` or `System`   |
| Freeze                | Operator, Policy owner, or Platform admin | `admin`, `operator` when Policy permits    | `policy-rule`, `incident-break-glass`, or `system-invariant` | `System` or `Policy`   |
| Emergency disable     | Platform admin                            | `admin`                                    | `incident-break-glass` or `system-invariant`                 | `Policy` or `System`   |
| Policy draft          | Policy owner                              | `admin` in v1                              | `workspace-rbac`                                             | `Policy`               |
| Policy simulate       | Policy owner, Operator, or Auditor        | `admin`, `operator`, `auditor`             | `workspace-rbac`                                             | optional `Policy`      |
| Policy activate       | Policy owner                              | `admin` in v1                              | `policy-change-approval`                                     | `Policy`               |
| Policy rollback       | Policy owner or Platform admin            | `admin`                                    | `policy-change-approval` or `incident-break-glass`           | `Policy`               |
| Audit annotation      | Auditor                                   | `admin`, `auditor`                         | `workspace-rbac`                                             | `System`               |

### Separation of Duties rules

The current v1 RBAC roles are intentionally small. These rules therefore apply even when one person holds multiple roles:

1. The actor who requested or proposed an externally-effectful Action must not be the sole approver for that Action.
2. A user who drafts a risky Policy weakening must not be the only actor who activates it.
3. Emergency disable and break-glass override must be reviewed after the fact by an Auditor or different Platform admin.
4. Domain SME advice may support approval, but it is not itself an Approval Gate decision unless the actor also has approval authority.
5. Handoff transfers current ownership; it does not erase the originating actor, prior rationale, or previous accountable decisions.
6. Small-team overlap is allowed only when Policy explicitly permits the overlap and the Evidence Log records the overlap reason.

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

| Input type        | Meaning                                                | Typical attachment           | Durable effect                                                                  |
| ----------------- | ------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------- |
| Intent            | Desired outcome, success condition, and constraints    | Run, Plan                    | Creates or revises a Run charter and Plan context.                              |
| Constraint        | Hard boundary, forbidden path, budget, scope, or limit | Run, Policy, Approval        | Narrows what the agent may do; may trigger a new Plan or Policy evaluation.     |
| Taste             | Subjective quality bar for creative or strategic work  | Plan, Evidence Artifact      | Guides acceptance criteria or artifact review without granting execution power. |
| Insight           | Domain observation that changes interpretation         | Run, Approval, Evidence      | Adds contextual evidence for current or later decisions.                        |
| Steering          | Mid-run redirect without replacing the agent           | Run                          | Changes next actions, scope, routing, or paused/resumed state.                  |
| Approval decision | Approve, deny, request changes, or defer               | Approval Gate, policy change | Resolves a gated Plan or policy change and unblocks or stops execution.         |
| Override          | Exceptional deviation from normal rule path            | Policy change, Run, Action   | Requires explicit authority, rationale, and evidence-backed audit entry.        |
| Escalation        | Route to another person, queue, or authority level     | Approval, Run                | Changes owner/queue and carries the current decision packet forward.            |
| Audit annotation  | Post-hoc observation tied to evidence                  | Evidence Artifact, Run       | Adds review context without changing execution state.                           |

Free-text notes are allowed, but the control plane should preserve the semantic type of the human intervention.

### Canonical input contract

Every typed operator input must be representable as an attributable control-plane record. The exact storage object may vary by implementation, but the canonical fields are:

- `inputId`
- `workspaceId`
- `inputType`
- `actorUserId`
- `governanceFunction`
- `authoritySource`
- `target`
- `rationale`
- `evidenceRefs`
- `createdAtIso`
- `effect`

`target` must identify one or more of:

- `runId`
- `approvalId`
- `planId`
- `policyId` and policy version
- `evidenceId`
- `workItemId`
- `externalRefs`

`effect` must state whether the input:

- changes execution state now
- changes approval state now
- changes future policy behaviour
- adds context only
- routes work to another person or queue

This distinction is mandatory because Cockpit must not make an annotation look like approval, a preference look like policy, or steering look like direct tool execution.

### Attachment semantics

| Object            | Inputs that may attach                                           | Notes                                                                                        |
| ----------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Run               | Intent, constraint, steering, escalation, override, annotation   | A Run holds the current charter, live state, and intervention history.                       |
| Approval Gate     | Approval decision, constraint, escalation, insight, annotation   | Approval inputs resolve or reroute a specific gated Plan or policy change.                   |
| Plan              | Intent, constraint, taste, approval decision references          | Plans describe intended effects; taste can define quality criteria, not hidden execution.    |
| Evidence Artifact | Taste, insight, audit annotation, approval decision references   | Evidence preserves what the operator saw, added, or relied on.                               |
| Policy            | Constraint, override, policy input, approval decision references | Policy input changes future routing; it must not silently rewrite the current live approval. |
| Work Item         | Intent, escalation, annotation, outcome summary                  | Work Items bind cross-system context but should not absorb provider-specific implementation. |

### Steering is not direct execution

Steering changes the governed Run's intent, constraints, routing, or next-step request. It does not let the operator secretly invoke a data-plane tool outside the Policy and Evidence path.

Examples:

- "Narrow this run to invoices under AUD 5,000" is steering.
- "Pause until finance reviews the vendor match" is steering.
- "Use the billing adapter to write invoice INV-123 now" is a proposed Action and must go through Policy, Plan, Approval, and Evidence as required by tier.

### Taste and insight without micromanagement

Taste and insight should help agents make better choices without turning the operator into the worker.

Acceptable capture:

- reusable quality criteria for a Plan or artifact class
- concise domain correction attached to Evidence
- a ranked preference between agent-proposed alternatives
- a review note that changes future prompts, playbooks, or Policy routing

Avoid:

- step-by-step instructions for routine agent work
- free-text preferences that silently weaken Policy
- asking the operator to inspect every low-risk intermediate artifact
- treating subjective taste as a universal approval reason in finance, security, compliance, or operations domains

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

The normative shared packet is [Decision Context Packet v1](./decision-context-packet-v1.md). Minimum context packet:

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

### R7a Canonical UI states

Cockpit must name operator states by what the human can safely do next.

| UI state            | Meaning                                                        | Primary inputs                                      |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `observing`         | Run is progressing within Policy and no human action is needed | Annotation, audit annotation                        |
| `needs-approval`    | A gated Plan or policy change is waiting for a decision        | Approval decision, escalation, request changes      |
| `needs-steering`    | The agent can continue only after direction or scope change    | Steering, constraint, escalation                    |
| `needs-evidence`    | The current packet is insufficient for a decision              | Request changes, insight, escalation                |
| `policy-blocked`    | Policy denies the Action or current route                      | Annotation, escalation, future Policy input         |
| `degraded-realtime` | Cockpit may be showing stale, cached, or delayed state         | Annotation only until refreshed or explicitly stale |
| `handoff-pending`   | Ownership or queue transfer is in progress                     | Escalation, handoff confirmation                    |
| `frozen`            | Work is intentionally stopped for safety or investigation      | Audit annotation, authorized resume or override     |
| `resolved`          | Decision or intervention has been recorded                     | Audit annotation                                    |

These UI states are not a replacement for `RunStatus` or `ApprovalStatus`. They are the presentation layer's operator posture derived from Run, Approval, Policy, Evidence, and realtime freshness.

### R8 Mode-aware UI

Cockpit must distinguish when the human is:

- monitoring
- steering
- approving
- auditing
- changing Policy

The same button shape must not hide materially different authority or consequences.

Mode switching must preserve the target object. Moving from a live approval to Policy Studio may create a future Policy draft, but it must not silently mutate the current pending Approval Gate or Plan.

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

The Cockpit Run intervention surface must preserve the action semantics below so
that generic buttons cannot disguise different consequences or authority levels.

| Intervention          | UI surface | Authority source     | Effect scope              | Required affordance                       |
| --------------------- | ---------- | -------------------- | ------------------------- | ----------------------------------------- |
| pause                 | steering   | run charter          | current Run               | rationale and evidence-backed audit entry |
| resume                | steering   | run charter          | current Run               | current blocked/frozen state visible      |
| reroute               | steering   | run charter          | current Run               | target person or Workforce Queue          |
| handoff               | steering   | delegated role       | current Run               | previous and new owner visible            |
| escalate              | steering   | delegated role       | current Run               | higher authority or queue target          |
| request-more-evidence | approval   | policy rule          | Approval Gate             | missing evidence as first-class state     |
| freeze                | steering   | policy rule          | current Run               | explicit non-routine acknowledgement      |
| sandbox               | steering   | policy rule          | contained current Run     | degraded containment state visible        |
| emergency disable     | emergency  | incident break-glass | workspace safety boundary | explicit break-glass acknowledgement      |
| annotate              | monitoring | audit annotation     | context only              | no state-change implication               |

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
- accountable actor
- rationale
- affected scope
- evidence references consulted
- resulting action or state transition
- current role set and future permission slice when available
- previous owner and new owner for handoff or escalation
- expiry and review deadline for override, freeze, or emergency action
- timestamp and correlation to Run, Approval Gate, Plan, or Policy version

Every approval, denial, reroute, handoff, override, freeze, and policy change must be explainable after the fact.

### Evidence categories for operator input

Operator input should map to existing Evidence categories unless a later schema version adds a dedicated type:

| Input type                         | Evidence category  | Required links                                      |
| ---------------------------------- | ------------------ | --------------------------------------------------- |
| Intent, constraint, steering       | `Plan` or `System` | `runId`, `planId` when one exists                   |
| Approval decision, request changes | `Approval`         | `approvalId`, `runId`, `planId`                     |
| Policy input, override             | `Policy`           | `policyId`, policy version, `runId` where relevant  |
| Taste, insight, audit annotation   | `System`           | `runId` or `evidenceId`, plus artifact refs if used |
| Handoff or escalation              | `System`           | `runId`, `approvalId` where relevant, target queue  |

The immutable metadata entry must be enough to prove who acted, what authority was used, which object changed, and which evidence packet was visible. Larger payloads, snapshots, and transcripts belong in retention-managed payload references.

### Current versus future effect

Each operator input must be classified as one of:

- `current-run-effect`: changes or blocks the active Run, Plan, Approval, or queue routing.
- `future-policy-effect`: changes future Policy, routing, evidence requirements, or autonomy posture.
- `context-only`: records taste, insight, or audit context without changing execution state.

Cockpit must surface this classification before the operator submits the input.

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
- Intent, taste, and insight are typed inputs with explicit attachment points rather than unstructured comments.
- Steering cannot bypass Policy, Plan, Approval, or Evidence controls for externally-effectful Actions.
- Cockpit can derive a clear operator UI state from Run, Approval, Policy, Evidence, and realtime freshness.
- The system supports oversight that is useful at business scale rather than ceremonial at demo scale.
- The model preserves calm operations while keeping intervention power real.

## Open Questions

- Should `policy owner` become a first-class RBAC role or remain a permission slice over `admin` and `approver` capabilities?
- Which `policy owner` permission slices should graduate first from the v1 `admin` mapping?
- Which intervention actions are reversible versus compensatable across different Port families?
- How much operator-specific personalisation is safe before it weakens team-level consistency?
- What minimum training or readiness evidence should be required before a user can approve high-risk Actions?

## Traceability Links

- [README.md](../../README.md)
- [docs/project-overview.md](../../docs/project-overview.md)
- [docs/explanation/agent-traffic-controller.md](../../docs/explanation/agent-traffic-controller.md)
- [docs/internal/engineering-layer/hci-principles.md](../../docs/internal/engineering-layer/hci-principles.md)
- [docs/internal/ui/cockpit/mission-control-convergence.md](../../docs/internal/ui/cockpit/mission-control-convergence.md)
- [.specify/specs/approval-v1.md](./approval-v1.md)
- [.specify/specs/evidence-v1.md](./evidence-v1.md)
- [.specify/specs/agent-action-governance-lifecycle-v1.md](./agent-action-governance-lifecycle-v1.md)
- [.specify/specs/plan-v1.md](./plan-v1.md)
- [.specify/specs/presentation-layer-reference-cockpit-v1.md](./presentation-layer-reference-cockpit-v1.md)
- [.specify/specs/run-v1.md](./run-v1.md)
