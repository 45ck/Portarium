# Cockpit Policy Operator Language v1

**Status:** Proposed
**Related Beads:** bead-1084, bead-1085, bead-1086, bead-1088, bead-1089, bead-1090
**Extends:** [Cockpit Policy Authoring and Simulation v1](./cockpit-policy-authoring-and-simulation-v1.md), [Operator Interaction Model v1](./operator-interaction-model-v1.md)

## Purpose

Define the operator-facing terminology and progressive-disclosure model Cockpit uses when explaining Policy authoring, approval routing, simulation, replay, and audit context.

The model is named the **Policy Explanation Ladder**. Every Cockpit policy surface should climb the ladder in the same order:

1. current work
2. effective decision
3. required evidence and authority
4. future policy effect
5. deeper mechanics

This prevents each screen from inventing its own vocabulary for Policy, Execution Tier, Approval Gates, and evidence.

## Scope

In scope:

- canonical operator-facing labels across Policy Studio, Approvals, Simulation, and audit views
- summary-versus-detail rules for policy and authority surfaces
- explanation patterns for effective Policy outcomes
- disclosure rules for inheritance, overrides, break-glass, blast radius, and replay
- concrete examples using Portarium terminology for tools, connectors, and capabilities

Out of scope:

- new backend contracts
- replacing Policy, Approval, Run, Plan, Evidence, or Execution Tier domain objects
- detailed visual design for the clarity pass
- changing RBAC semantics

## Canonical Labels

Use the glossary terms for domain concepts, but make the first label answer the operator's practical question.

| Concept                        | Operator-facing label      | Detail label                               | Avoid as primary label |
| ------------------------------ | -------------------------- | ------------------------------------------ | ---------------------- |
| Policy                         | Policy                     | Policy rule, policy version                | doctrine, slice        |
| Effective Policy               | Effective decision         | Decision path, matched rules               | policy eval            |
| Execution Tier                 | Execution tier             | Auto, Assisted, Human-approve, Manual-only | tier code, risk tier   |
| Action                         | Action                     | Action class, capability action            | step, task             |
| Approval Gate                  | Approval needed            | Approval Gate                              | gate only              |
| Plan                           | Plan                       | Planned effects                            | raw proposal           |
| Diff                           | What will change           | Planned Effects, Verified Effects          | delta only             |
| Evidence Artifact              | Evidence                   | Evidence Artifact                          | proof blob             |
| Evidence Log                   | Audit trail                | Evidence Log                               | log stream             |
| Workspace / Tenant             | Workspace                  | Tenant boundary                            | org shard              |
| System of Record               | System of record           | SoR                                        | provider DB            |
| Port Family                    | Capability family          | Port Family                                | connector group        |
| Port                           | Capability                 | Port                                       | integration surface    |
| Adapter / Connector / Provider | Connector                  | Adapter, provider                          | plugin                 |
| Capability Matrix              | Capability matrix          | Capability Matrix                          | posture grid           |
| SoD Constraint                 | Separation of duties       | SoD Constraint                             | SoD only               |
| Break-glass                    | Emergency access           | Break-glass procedure                      | bypass                 |
| Override                       | Approved exception         | Override                                   | bypass, skip           |
| Blast radius                   | Impact scope               | Blast radius                               | damage radius          |
| Historical replay              | Replay                     | Historical replay report                   | simulation log         |
| Inheritance                    | Set by higher-level policy | Inheritance trace                          | inherited magic        |
| Runtime precedent              | Recent decision            | Runtime precedent                          | precedent only         |

### Execution Tier Labels

Execution Tier labels must preserve Portarium precision while explaining what happens next.

| Tier          | One-line operator summary                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Auto          | Portarium can run this Action without waiting for a human when required evidence is present.         |
| Assisted      | Portarium can draft and perform safe parts, but risky parts may pause for approval or more evidence. |
| Human-approve | A human with the required authority must approve before the Action runs.                             |
| Manual-only   | Portarium must not run the Action; it may create or track a Human Task instead.                      |

Use the hyphenated display labels `Human-approve` and `Manual-only` in operator surfaces. Code-style values such as `HumanApprove` and `ManualOnly` may appear only in deep technical detail, export, or audit payload views.

## Summary-Versus-Detail Rules

### Rule 1: Start with the current object of work

Every policy surface must first state the object the operator is working on:

- live Approval Gate
- draft Policy change
- capability default
- replay scenario
- audit review

Do not start with a raw rule table, matched-rule trace, JSON, or DSL editor.

### Rule 2: Separate current-run effect from future-policy effect

Every action prompt must say whether it affects:

- the current Run, Plan, Approval Gate, or queue route
- future matching Runs and Actions
- context only

Required labels:

| Effect scope           | Operator-facing wording            |
| ---------------------- | ---------------------------------- |
| `current-run-effect`   | This changes the current case.     |
| `future-policy-effect` | This changes future similar cases. |
| `context-only`         | This records context only.         |

Policy Studio must never imply that applying a precedent to a draft changes the pending live Approval Gate. Approvals must never imply that approving a live case publishes a reusable Policy.

### Rule 3: Give the effective decision before the mechanics

For any governed Action, the first policy summary must answer:

1. Is Portarium allowed to run it?
2. If not, what is needed before it can run?
3. Which Execution Tier applies?
4. What evidence or authority is missing?

Matched rules, inheritance traces, policy versions, and DSL snippets belong behind detail expansion.

### Rule 4: Show evidence sufficiency before raw evidence

Evidence summaries must say whether the packet is enough for the decision:

- Evidence complete
- Evidence missing
- Evidence stale
- Evidence conflicts
- Evidence not required for this decision

The Evidence Artifact list and Evidence Log trace are detail layers.

### Rule 5: Keep authority near the decision

Approval, override, break-glass, rollback, and activation controls must show:

- who can act
- what authority source permits the action
- whether Separation of Duties permits this actor
- whether a rationale is required
- whether the action expires or needs review

Do not make the operator search the audit detail to discover they cannot act.

## Effective Policy Explanation Pattern

Use this pattern for every Policy summary, Approval Gate explanation, Simulation result, and audit reconstruction.

### Pattern

`Portarium decided [decision] because [policy reason]. This applies to [Action/capability] on [system/resource] in [Workspace/environment]. It requires [evidence] and [authority]. [Current/future effect].`

### Required Fields

| Field                | Question answered              | Example                                              |
| -------------------- | ------------------------------ | ---------------------------------------------------- |
| Decision             | What happens next?             | Approval needed                                      |
| Execution Tier       | How much autonomy is allowed?  | Human-approve                                        |
| Action or capability | What work is governed?         | Send external email                                  |
| System or resource   | Where does it happen?          | Gmail connector in production                        |
| Conditions           | When does this rule apply?     | External recipients and persistent template changes  |
| Evidence             | What must be shown?            | Planned Effects, recipient list, rollback plan       |
| Authority            | Who can decide?                | Approver from Legal queue, not the Run initiator     |
| Reason               | Why this decision?             | High blast radius and customer-visible communication |
| Effect scope         | Does this affect now or later? | Current case only                                    |

### Summary Template

Use this for compact cards:

`Approval needed: sending external email through Gmail is Human-approve in production. Legal approval is required because the message reaches customers and the Evidence packet is missing a recipient diff.`

### Detail Template

Use this after expansion:

`Matched Policy rule EXT-COMMS-001 from the Workspace capability default. Organisation policy sets customer-facing CommsCollaboration writes to Human-approve. This draft tightens the rule by requiring a rollback plan for persistent templates. The current Approval Gate is not changed by this draft until the Policy change is activated.`

## Progressive Disclosure Model

The ladder has five layers. A surface may stop early, but it must not skip earlier layers.

### L1 Current Work

Answer:

- What live case, draft, replay, or audit object is selected?
- What is the operator expected to do next?
- Is this about deciding now, changing future Policy, or inspecting history?

Show:

- object title
- Workspace
- system of record or connector
- Action/capability
- current state
- next safe action

Hide by default:

- rule identifiers
- policy JSON
- full inheritance trace
- raw Evidence Log entries

### L2 Effective Decision

Answer:

- What did Policy decide?
- Which Execution Tier applies?
- Is anything blocked, missing, or waiting?

Show:

- effective decision
- Execution Tier
- one primary reason
- required evidence state
- required authority state

Hide by default:

- every matched rule
- condition-group tree
- replay sample list

### L3 Evidence and Authority

Answer:

- What evidence supports the decision?
- Who can act?
- Does Separation of Duties allow the current actor to act?

Show:

- evidence sufficiency
- required Evidence Artifacts
- eligible role, Workforce Queue, or policy owner
- authority source
- SoD status
- rationale requirement

Hide by default:

- complete audit chain
- raw artifact payloads
- role graph internals

### L4 Future Policy Effect

Answer:

- What changes if this draft is published?
- Which future Actions, Runs, or Workspaces are affected?
- Does it loosen, tighten, or reroute control?

Show:

- What will change
- effective-from time
- expiry if temporary
- affected capability family
- approval queue impact
- replay summary

Hide by default:

- all replay rows
- unchanged policy sections
- low-level diff syntax

### L5 Deep Mechanics

Answer:

- Which exact rules matched?
- Which higher-level Policy supplied the default?
- Which override or break-glass path was used?
- What did replay evaluate?
- What exact Evidence Log entries prove the outcome?

Show on demand:

- matched rules trace
- inheritance trace
- policy version diff
- JSON or DSL
- historical replay report
- Evidence Log entries
- audit export

Deep mechanics must be accessible, linkable, and copyable for auditors and expert policy owners. They must not be the default first reading burden for routine exploration.

## Disclosure Rules for Advanced Concepts

### Inheritance

Summary rule:

- Show the closest effective source first.
- Say whether the current layer tightens, repeats, or is blocked from weakening the higher-level Policy.

Operator wording:

- `Set by Workspace default`
- `Tightened by this capability rule`
- `Cannot be loosened here because organisation policy requires Human-approve`

Detail disclosure:

- expose the full chain as `Platform baseline -> Tenant autonomy profile -> Workspace profile -> capability default -> rule override -> Action decision`
- show policy version, owner, and last reviewed date for each layer

### Overrides

Summary rule:

- Call an override an approved exception, not a bypass.
- State what it changes, who approved it, when it expires, and what review is required.

Operator wording:

- `Approved exception active until 2026-05-05`
- `This exception raises the tier from Manual-only to Human-approve for this incident response Run`

Detail disclosure:

- original decision
- overridden decision
- authority source
- approving user
- rationale
- expiry
- review deadline
- Evidence Log entry

### Break-Glass

Summary rule:

- Present break-glass as emergency access with stronger accountability.
- Never present it as a routine shortcut.

Operator wording:

- `Emergency access required`
- `Use only for an active incident. This records a Policy evidence entry and requires post-incident review.`

Detail disclosure:

- incident identifier or Work Item
- permitted scope
- allowed duration
- accountable Platform admin or policy owner
- required Auditor review
- disabled controls outside the emergency scope

### Blast Radius

Summary rule:

- Show impact in business terms before counts.
- Use counts as supporting detail, not the headline.

Operator wording:

- `Customer-visible communication`
- `Touches production billing records`
- `Persistent automation will keep running after this Run ends`
- `Estimated impact: 42 Parties, 18 open Opportunities, 1 Salesforce connector`

Detail disclosure:

- impacted canonical objects
- systems of record
- Work Items
- Runs and Approval Gates
- persistence and reversibility
- estimate confidence and data freshness

### Replay

Summary rule:

- Explain replay as a safe historical check.
- Say replay does not invoke live Actions or change Approval state.

Operator wording:

- `Replay checks how the proposed Policy would have handled recent Runs without changing them.`
- `This draft would move 12 recent Actions from Auto to Human-approve and block 2 Manual-only Actions.`

Detail disclosure:

- replay window
- sample size
- affected Action classes
- current versus proposed decision counts
- approval queue impact
- blocked-action delta
- replay Evidence Artifact

## Surface-Specific Requirements

### Policy Studio

Default order:

1. working context
2. current effective decision
3. draft change and time horizon
4. evidence and authority requirements
5. simulation and replay summary
6. advanced rule detail

Required labels:

- `Working on`
- `Current policy`
- `Draft change`
- `This live case`
- `Future similar cases`
- `Evidence and authority`
- `Replay summary`

The first viewport must make clear whether the operator is editing a draft, reviewing the published default, or using a live Approval Gate as precedent.

### Approvals

Default order when opened from Policy Studio:

1. focused live Approval Gate
2. why this case is gated
3. decision controls
4. evidence sufficiency
5. policy context and return path
6. queue context and audit detail

Required labels:

- `Decide this case`
- `Why approval is needed`
- `Policy thread`
- `Return to Policy Studio`

Queue-management controls are secondary in a policy-linked focused review.

### Simulation

Default order:

1. scenario or replay target
2. current outcome
3. proposed outcome
4. changed decision counts
5. affected evidence or authority requirements
6. matched-rule trace

Required labels:

- `Current outcome`
- `Proposed outcome`
- `Would change`
- `No live Actions run`

### Audit Views

Default order:

1. final outcome
2. actor and authority source
3. evidence consulted
4. policy version and matched rules
5. timeline and raw entries

Required labels:

- `What happened`
- `Who had authority`
- `Evidence used`
- `Policy version`
- `Audit trail`

## Examples

### Example 1: Tool Semantics

Scenario: an OpenClaw Machine asks to run `write:file` in a production repository.

Summary:

`Approval needed: writing a file in a production repository is Human-approve. Portarium requires an approver who did not start the Run, plus a Planned Effects diff and rollback plan.`

Detail:

`The OpenClaw tool blast-radius policy classifies write:file as Mutation. Production policy requires Human-approve for mutation Actions. The current actor can inspect and request changes, but cannot approve because Separation of Duties prevents self-approval.`

### Example 2: Connector Semantics

Scenario: a Workflow proposes updating a Zendesk Ticket through the CustomerSupport connector.

Summary:

`Assisted: updating the Zendesk Ticket can proceed after Portarium verifies the planned field changes. Approval is not required because the Ticket is internal, reversible, and below the configured blast-radius threshold.`

Detail:

`The Action targets the CustomerSupport capability family through the Zendesk connector. Workspace policy allows reversible internal Ticket updates at Assisted when the Planned Effects diff lists changed fields, ExternalObjectRefs, and rollback guidance.`

### Example 3: Capability Default

Scenario: a policy owner edits the default for customer-facing CommsCollaboration writes.

Summary:

`Draft change: future customer-facing messages will move from Assisted to Human-approve. This does not decide the current Approval Gate until the Policy change is activated.`

Detail:

`The capability default applies to CommsCollaboration Actions that send or publish customer-visible content. Replay estimates that 9 recent Actions would have required approval and 0 would have moved to Manual-only.`

### Example 4: Inherited Hard Limit

Scenario: a workspace policy owner tries to lower production billing deletes to Auto.

Summary:

`Cannot loosen here: organisation policy requires Manual-only for production billing deletes.`

Detail:

`The Tenant autonomy profile sets delete Actions against FinanceAccounting systems of record to Manual-only in production. Workspace policy may add evidence or routing requirements, but it cannot lower the Execution Tier below the inherited hard limit without an approved exception path.`

### Example 5: Break-Glass Incident

Scenario: a Platform admin needs emergency access during a production incident.

Summary:

`Emergency access required: this incident response action needs break-glass authority, a rationale, expiry, and post-incident Auditor review.`

Detail:

`The break-glass procedure permits the Platform admin to activate a temporary approved exception for Work Item WI-2034. The exception expires in 2 hours, records Policy evidence, and does not change future policy defaults.`

### Example 6: Replay Result

Scenario: a policy owner simulates requiring Legal approval for external contract emails.

Summary:

`Replay: this draft would move 14 recent CommsCollaboration Actions from Assisted to Human-approve. No live Actions run and no Approval Gate changes during replay.`

Detail:

`Replay evaluated 90 days of governed Runs and queued Approval Gates. The proposed rule matched external-recipient email Actions with Subscription or Order references. It increased Legal queue load by an estimated 3 approvals per week.`

## Anti-Patterns

Avoid:

- using `posture`, `slice`, `precedent`, or `eval` as first-level labels
- showing raw rule identifiers before the effective decision
- mixing current live approval decisions with future Policy drafts
- calling break-glass or overrides a bypass
- making blast radius visible only as a number
- hiding SoD failure until submit time
- presenting replay as if it changes live state
- using code-style enum labels in routine operator copy
- treating connector names as the governed work instead of naming the Action and capability

## Acceptance Signals

- Cockpit can explain a governed Action in the same order across Policy Studio, Approvals, Simulation, and audit views.
- Operators can distinguish current-case decisions from future Policy changes before acting.
- Execution Tier, evidence, authority, and Separation of Duties appear before deep mechanics.
- Advanced governance detail remains available without becoming the default reading burden.
- Tool, connector, and capability examples preserve Portarium terminology while reading as operational language.

## Traceability Links

- [docs/glossary.md](../../docs/glossary.md)
- [Cockpit Policy Authoring and Simulation v1](./cockpit-policy-authoring-and-simulation-v1.md)
- [Cockpit Policy Clarity Pass v1](./cockpit-policy-clarity-pass-v1.md)
- [Operator Interaction Model v1](./operator-interaction-model-v1.md)
- [Policy Change Workflow v1](./policy-change-workflow-v1.md)
- [Execution Tier Policy v1](./execution-tier-policy-v1.md)
- [OpenClaw Tool Blast-Radius Policy v1](./openclaw-tool-blast-radius-policy-v1.md)
- [Policy Studio Mental-Model Audit](../../docs/internal/ui/cockpit/policy-studio-mental-model-audit.md)
- [Policy Studio Cognitive-Friction Review](../../docs/internal/ui/cockpit/policy-studio-cognitive-friction-review.md)
