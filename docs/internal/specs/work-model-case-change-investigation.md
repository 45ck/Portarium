# Specification: Portarium Work Model — Case, Change, Investigation

**Status:** Proposed
**Owner:** Calvin / Portarium
**Scope:** Domain model, information architecture, live surfaces, runtime model, naming, migration guidance
**Related existing docs:**
- `README.md`
- `docs/explanation/architecture.md`
- `docs/internal/ui/project-ui-v1.md`
- `docs/internal/research/mission-control-ui-domain-model.md`

---

## 1. Executive Summary

Portarium should **not** change its core role.

Portarium remains:
- the **control plane**
- the **governance layer**
- the place for **policy, approvals, evidence, audit, visibility, and routing**

Portarium should **not** become "the agent" and should **not** become a monolithic IDE/browser host.

What **does** need to change is the **work model** and the **way the product explains work**.

The current generic `Work Item` abstraction is structurally useful, but too semantically vague. It is currently doing too much explanatory work. Users can understand that a Work Item is the binder that connects Runs, Approvals, and Evidence, but they still need an immediately understandable distinction between:

- business/operations work like replying to customers or updating records
- build/change work like writing code, editing websites, running previews, or deploying changes
- read-heavy discovery work like audits, investigations, and research

This spec introduces a first-class work taxonomy:

- **Case** — record-centric business work
- **Change** — workspace-centric artifact/system work
- **Investigation** — read-heavy analytical work

This taxonomy lives at the **Work Item kind** level, not at the Project level.

This preserves the existing architecture:

- **Workspace** remains the top-level container for people, policy, credentials, connectors, and evidence
- **Project** remains a lightweight scope/grouping container
- **Work Item** remains the central unit of work and the primary detail hub
- **Run**, **Approval Gate**, and **Evidence Log** remain the shared governance and execution story across all work kinds

The result is:

- a much easier mental model for users
- a clean split between **governance** and **execution substrate**
- a durable way to support both operations and development without forking the product into multiple modes

---

## 2. Architectural Invariants

These must remain true after adopting this spec.

### 2.1 Portarium remains the control plane

Portarium governs and supervises work. It is not the worker. It is not the underlying system of record. It is not the repo host. It is not the CRM. It is not the browser automation engine itself.

Portarium is responsible for:
- intent intake
- policy evaluation
- risk classification
- approval routing
- execution authorization
- evidence linking
- auditability
- workflow and run orchestration
- surfacing work in Cockpit/Mission Control

### 2.2 Execution remains separate from governance

Portarium must preserve a split between:

- **control plane runtime** — HTTP APIs, governance boundaries, workflow coordination, approval state, evidence linking
- **execution plane runtime** — workers, adapters, tool execution, browser sessions, terminals, isolated environments, long-running tasks

This applies equally to Cases, Changes, and Investigations.

### 2.3 One governance model across all work types

Portarium should not create separate approval/evidence/policy systems for operations work versus development work.

All work kinds use the same core governance concepts:
- Work Item
- Run
- Plan
- Approval Gate
- Evidence Log
- Policy tier
- Actor identity
- audit trail

The thing that changes is the **execution substrate** and the **live surface**, not the governance backbone.

### 2.4 Project remains generic

A Project is a scope/grouping tool. It must remain capable of containing mixed work:
- Cases
- Changes
- Investigations

The Project itself should not encode whether something is “ops” or “dev.”

That distinction belongs on the **Work Item**.

---

## 3. Problem Statement

### 3.1 The current problem

The current model explains that a Work Item is the cross-system binder connecting ExternalObjectRefs, Runs, Approvals, and Evidence. This is structurally sound, but it is not enough for user comprehension.

Users intuitively perceive a difference between:
- “respond to this customer”
- “fix this software bug”
- “investigate why this failed”

Without a first-class distinction, the UI risks feeling like:
- one giant abstract queue
- one giant generic work list
- an agent control system that is conceptually powerful but semantically muddy

### 3.2 The hidden design tension

There are actually **two distinct axes** that can be confused:

#### Axis A — Governance vs execution
This is architectural.

- Portarium / Cockpit = governance, visibility, approvals, routing, evidence
- runtimes / agents / connectors / browsers / terminals = execution

#### Axis B — Operate vs build vs investigate
This is product/domain semantics.

- operational work
- build/change work
- research/investigation work

The product should not confuse these axes.

### 3.3 Desired outcome

The product should be simple enough that a user can explain it as:

> Portarium governs work.
> Work lives inside Projects.
> Each work item is either a Case, a Change, or an Investigation.
> Cases act on business records.
> Changes act on products, code, content, or environments.
> Investigations read and analyze before action is taken.
> All of them use the same approval, policy, run, and evidence model.

---

## 4. Goals

### 4.1 Product goals

- make the work model obvious to normal users
- support both business operations and technical/development work without separate products
- preserve one control-plane and evidence model
- support solo and team usage equally
- enable future vertical packs without reworking the core work taxonomy

### 4.2 UX goals

- make it obvious what kind of work an item represents
- show the right live surface for the work kind
- reduce ambiguity in inboxes, lists, and detail pages
- keep the UI coherent across work kinds

### 4.3 Architectural goals

- keep Project generic
- keep Work Item as the center of gravity
- model runtime-heavy Change work cleanly
- avoid collapsing governance and execution into one system
- support local-first and remote/cloud execution under the same abstraction

### 4.4 Non-goals

This spec does not attempt to:
- replace the core Portarium architecture
- redefine policy tiers
- define every vertical pack in detail
- redesign every Cockpit screen pixel-by-pixel
- fully specify the execution worker implementation for all adapters

---

## 5. Core Mental Model

### 5.1 Primary sentence

**Portarium governs work.**

### 5.2 Work organization model

- **Workspace** — where people, roles, policies, connectors, credentials, notifications, and evidence governance live
- **Project** — a lightweight scope/grouping container for related work
- **Work Item** — one unit of work inside a Project
- **Run** — one execution attempt for a Work Item via a workflow/runbook/agent path
- **Approval Gate** — a human decision point inside execution
- **Evidence Log** — the linked story of plan, approval, action, outcome, and payloads

### 5.3 Work Item kinds

Every Work Item must have a `kind`.

Supported kinds:
- `case`
- `change`
- `investigation`

---

## 6. Work Item Kind Definitions

## 6.1 Case

A **Case** is a unit of work centered on one or more business records.

A Case typically involves:
- customers
- tickets
- leads
- invoices
- employees
- orders
- support threads
- emails
- CRM records
- helpdesk entries
- business tasks within existing systems of record

### 6.1.1 Short definition

**Case = record-centric business work.**

### 6.1.2 Typical examples

- reply to a customer support email
- triage a Zendesk ticket
- review and approve a refund request
- enrich a CRM lead from research
- chase an overdue invoice
- prepare a draft email for a candidate
- update a sales opportunity based on new information

### 6.1.3 Common substrate

A Case usually executes via:
- Gmail / Outlook
- Slack / Teams / Discord
- CRM
- ERP
- helpdesk
- calendar
- docs / notes
- APIs against systems of record

### 6.1.4 Typical risk pattern

- customer-facing communication risk
- compliance risk
- financial data risk
- privacy risk
- incorrect record mutation risk

### 6.1.5 Typical outputs

- sent or drafted communication
- updated record
- escalated issue
- scheduled follow-up
- attached note or summary
- structured decision or recommendation

---

## 6.2 Change

A **Change** is a unit of work centered on modifying an artifact, system, environment, or product.

A Change typically involves:
- code
- websites
- infrastructure
- content assets
- documentation
- deployment configs
- design files
- test suites
- previews
- branches and environments

### 6.2.1 Short definition

**Change = workspace-centric artifact/system work.**

### 6.2.2 Typical examples

- fix a software bug
- build a new feature
- redesign a landing page
- update website copy and publish a preview
- create a demo video or marketing asset
- refactor infrastructure configuration
- change CI/CD logic
- update documentation and open a PR
- run tests, validate preview, and prepare deployment

### 6.2.3 Common substrate

A Change usually executes via:
- git repo / branch
- file system
- code editor view
- terminal
- isolated runtime or container
- browser session for preview/QA/research
- dev server
- CI/CD system
- preview deployment

### 6.2.4 Typical risk pattern

- production breakage risk
- security regression risk
- data loss risk
- deploy risk
- brand/reputational risk for externally visible changes
- correctness/test coverage risk

### 6.2.5 Typical outputs

- changed files
- diff / patch
- branch or PR
- preview URL
- build artifacts
- deployment result
- test evidence
- screenshots / recordings

---

## 6.3 Investigation

An **Investigation** is a unit of work centered on understanding, analyzing, auditing, comparing, diagnosing, or researching before action is taken.

An Investigation is primarily read-heavy rather than write-heavy.

### 6.3.1 Short definition

**Investigation = read-heavy analytical work.**

### 6.3.2 Typical examples

- investigate why a run failed
- audit a customer’s website and identify issues
- research competitors before drafting strategy
- analyze support patterns for recurring complaints
- diagnose a deployment incident
- evaluate providers/connectors
- assess risk before performing a change
- inspect logs, traces, screenshots, and artifacts to determine cause

### 6.3.3 Common substrate

An Investigation may use:
- logs
- evidence history
- analytics
- browser sessions for inspection
- code readers
- terminal tools in read-only mode
- docs and knowledge sources
- reporting tools
- system-of-record reads

### 6.3.4 Typical risk pattern

Lower write risk by default, but still may involve:
- sensitive data exposure
- incorrect conclusions
- hallucinated analysis if evidence is weak
- accidental side effects if tools are not read-only

### 6.3.5 Typical outputs

- report
- diagnosis
- recommendation
- decision brief
- prioritized findings
- conversion into a Case or Change
- explicit “no action recommended” outcome

### 6.3.6 Important rule

Investigation must not imply safety by category alone. Read-heavy work may still require approval if:
- sensitive sources are accessed
- regulated data is exposed
- external reporting is generated
- a read-only boundary cannot be guaranteed

---

## 7. Why the Distinction Belongs on Work Item, Not Project

A Project is a scope container. Real projects often contain mixed work.

Examples:

### 7.1 Website modernization project
May include:
- Investigation: audit current site
- Change: build redesign preview
- Case: send proposal email and manage client communication

### 7.2 Customer operations project
May include:
- Case: respond to support threads
- Investigation: analyze recurring complaints
- Change: update macros, workflows, or automation rules

### 7.3 Software delivery project
May include:
- Investigation: diagnose flaky CI failures
- Change: patch code and update infra
- Case: communicate release timing to stakeholders

Therefore:
- Project must remain generic
- Work Item kind must carry the semantic distinction

---

## 8. Domain Model Changes

## 8.1 Core types

```ts
export type WorkItemKind = 'case' | 'change' | 'investigation'

export type WorkItemStatus =
  | 'new'
  | 'triaged'
  | 'in_progress'
  | 'blocked'
  | 'awaiting_approval'
  | 'done'
  | 'cancelled'

export interface WorkItem {
  id: string
  projectId: string
  kind: WorkItemKind
  title: string
  objective: string
  description?: string
  status: WorkItemStatus
  ownerUserId?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  tags?: string[]
  linkedObjectRefs: ExternalObjectRef[]
  runIds: string[]
  approvalIds: string[]
  evidenceIds: string[]
  runtimeId?: string
  outputArtifactIds?: string[]
  createdAt: string
  updatedAt: string
}
```

## 8.2 Structural rules

- all Work Items must have a `kind`
- all Work Items may have Runs, Approvals, and Evidence
- only some Work Items need a `runtimeId`
- `runtimeId` is most common for `change`
- `investigation` may optionally use a runtime for deeper analysis
- `case` usually does not require a heavy isolated runtime, but may still use controlled execution contexts

## 8.3 Recommended optional subtype field

```ts
export interface WorkItem {
  // ...core fields
  subtype?: string
}
```

Examples:
- case/support
- case/sales
- case/finance
- change/software
- change/website
- change/infrastructure
- change/content
- investigation/audit
- investigation/incident
- investigation/research

Subtype should remain optional in MVP.

---

## 9. External Object References

ExternalObjectRefs remain central, but their most common targets differ by work kind.

```ts
export type ExternalObjectRef =
  | {
      id: string
      type: 'customer'
      system: string
      externalId: string
      displayLabel?: string
      deepLink?: string
    }
  | {
      id: string
      type: 'ticket'
      system: string
      externalId: string
      displayLabel?: string
      deepLink?: string
    }
  | {
      id: string
      type: 'invoice'
      system: string
      externalId: string
      displayLabel?: string
      deepLink?: string
    }
  | {
      id: string
      type: 'email-thread'
      system: string
      externalId: string
      displayLabel?: string
      deepLink?: string
    }
  | {
      id: string
      type: 'repo'
      system: string
      externalId: string
      displayLabel?: string
      deepLink?: string
    }
  | {
      id: string
      type: 'branch'
      system: string
      externalId: string
      displayLabel?: string
      deepLink?: string
    }
  | {
      id: string
      type: 'deployment'
      system: string
      externalId: string
      displayLabel?: string
      deepLink?: string
    }
  | {
      id: string
      type: 'preview-url'
      system: string
      externalId: string
      displayLabel?: string
      deepLink?: string
    }
  | {
      id: string
      type: 'document'
      system: string
      externalId: string
      displayLabel?: string
      deepLink?: string
    }
```

### 9.1 Typical usage by kind

#### Case
Common refs:
- customer
- ticket
- invoice
- email-thread
- employee
- order

#### Change
Common refs:
- repo
- branch
- deployment
- preview-url
- document/spec
- issue tracker ticket

#### Investigation
Common refs:
- evidence bundle
- logs/traces
- dashboard/report
- document
- ticket
- repo
- customer record

---

## 10. Runs, Plans, Approvals, and Evidence

These remain shared across all work kinds.

## 10.1 Run

A Run is one execution attempt.

A Run may be:
- fully automated
- assisted
- human-approved
- manual-only in terms of gating

A Run should never depend on work kind for its existence.

### 10.1.1 Run differences by work kind

#### Case
Run may execute:
- read customer context
- draft response
- propose record updates
- request approval
- perform allowed actions in CRM/helpdesk/email

#### Change
Run may execute:
- provision runtime
- create branch
- edit files
- run terminal commands
- launch preview
- run browser-based QA
- prepare PR/deploy
- request approval before risky actions

#### Investigation
Run may execute:
- gather evidence
- inspect artifacts/logs
- generate diagnosis
- produce recommendations
- optionally propose follow-up Case or Change items

## 10.2 Plan

Every work kind may have a Plan.

Plan semantics by kind:
- Case: intended record and communication changes
- Change: intended artifact/system/environment changes
- Investigation: intended scope of inquiry, sources, and expected outputs

## 10.3 Approval Gate

Approval Gates remain uniform, but copy and reviewed payloads differ by work kind.

#### Case approval examples
- send external email
- update invoice state
- apply refund
- escalate to customer

#### Change approval examples
- push branch
- open PR
- deploy preview to shared env
- apply infra change
- publish content

#### Investigation approval examples
- access sensitive logs
- inspect regulated data set
- send externally facing report
- convert findings into action automatically

## 10.4 Evidence Log

Evidence remains append-only and linked to:
- plan
- approval decision
- actor
- tool call
- result
- outcome
- payload references

Evidence categories continue to make sense across all work kinds:
- Plan
- Action
- Approval
- Policy
- System

---

## 11. Runtime Model

## 11.1 Key principle

Portarium should not model “browser” as the top-level primitive for Change work.

The top-level primitive should be a **managed execution environment**.

Suggested names:
- `MissionRuntime`
- `ExecutionCell`
- `DevWorkspace`
- `WorkRuntime`

Recommended neutral term: **WorkRuntime**

## 11.2 Why

A raw browser embed solves visibility, but not discipline.

Portarium needs:
- isolation
- repeatability
- resumability
- resource control
- snapshots
- crash recovery
- policy enforcement
- audit capture
- multiple concurrent tasks across projects

That requires a runtime, not just a browser pane.

## 11.3 Runtime definition

```ts
export type WorkRuntimeStatus =
  | 'provisioning'
  | 'ready'
  | 'busy'
  | 'paused'
  | 'failed'
  | 'terminated'

export interface WorkRuntime {
  id: string
  workspaceId: string
  projectId: string
  workItemId: string
  status: WorkRuntimeStatus
  resourceProfile: 'small' | 'medium' | 'large'
  repoUrl?: string
  branch?: string
  workspacePath?: string
  devServerUrl?: string
  terminalSessionIds: string[]
  browserSessionIds: string[]
  artifactIds: string[]
  snapshotIds: string[]
  createdAt: string
  updatedAt: string
}
```

## 11.4 Browser sessions

Browser should be a managed child resource of a runtime.

```ts
export type BrowserSessionRole =
  | 'app-preview'
  | 'research'
  | 'qa'
  | 'admin'
  | 'generic'

export type BrowserSessionControlMode = 'agent' | 'human' | 'shared'

export interface BrowserSession {
  id: string
  runtimeId: string
  role: BrowserSessionRole
  status: 'starting' | 'active' | 'idle' | 'crashed'
  controlMode: BrowserSessionControlMode
  debuggerEndpoint?: string
  liveViewUrl?: string
  recordingUrl?: string
  profileId?: string
  createdAt: string
  updatedAt: string
}
```

## 11.5 Terminal sessions

```ts
export interface TerminalSession {
  id: string
  runtimeId: string
  purpose: 'build' | 'test' | 'server' | 'generic'
  status: 'starting' | 'active' | 'idle' | 'exited' | 'failed'
  liveStreamUrl?: string
  createdAt: string
  updatedAt: string
}
```

## 11.6 Which work kinds use runtimes?

### Case
Usually light or no isolated runtime.

May still use:
- managed browser sessions for controlled UI automation
- ephemeral task contexts
- low-footprint execution cells if needed

### Change
Usually needs a runtime.

This is the primary runtime-heavy work kind.

### Investigation
Optional runtime.

Use when investigation involves:
- browser inspection
- read-only terminal tooling
- log analysis pipelines
- reproducible diagnosis in isolated env

## 11.7 Local-first MVP recommendation

The first runtime strategy should be local-first.

Use:
- a local supervisor/daemon
- Docker or equivalent isolation
- one runtime per Change work item
- browser + terminal + preview inside runtime
- WebSocket/live streaming back to Cockpit

Later, the same abstraction can target cloud workers.

---

## 12. Live Surface Model

Governance stays common. The live execution surface changes by work kind.

## 12.1 Shared layout frame

All work detail views should share:
- header with title, status, owner, priority, kind
- objective/summary
- policy/risk summary
- approvals section
- evidence section
- run history
- linked objects

## 12.2 Case live surface

Primary panels:
- linked business records
- conversation/timeline context
- draft actions/replies
- proposed record changes
- approval drawer
- evidence/log timeline

Secondary panels:
- notes
- actor history
- task checklist

## 12.3 Change live surface

Primary panels:
- code/file tree
- terminal stream
- browser preview(s)
- dev server / preview URL
- run/test results
- diff / artifacts
- approval drawer
- evidence/log timeline

Secondary panels:
- branch/PR info
- deployment status
- screenshot/video capture

## 12.4 Investigation live surface

Primary panels:
- evidence sources
- findings notebook/report
- logs/traces/artifacts viewer
- browser inspection pane if needed
- hypothesis / diagnosis / recommendations
- convert-to-action controls
- evidence/log timeline

Secondary panels:
- confidence markers
- source completeness indicators
- unresolved questions

## 12.5 Important UX rule

Do not create entirely separate applications for each kind.

Use one shell with kind-sensitive detail panes.

This preserves coherence while making the nature of work obvious.

---

## 13. Information Architecture Changes

## 13.1 Global navigation

Recommended top-level navigation:
- Inbox
- Projects
- Work
- Approvals
- Evidence
- Settings

## 13.2 Work navigation

Inside Work, expose kind-level segmentation:
- All Work
- Cases
- Changes
- Investigations

This can be tabs, filters, or segmented navigation.

## 13.3 Project navigation

Within a Project, recommended sections:
- Overview
- Work
- Runs
- Approvals
- Evidence
- Project settings

Inside Project Work:
- All
- Cases
- Changes
- Investigations

## 13.4 Inbox behavior

Inbox should remain the default landing.

Inbox items should visibly indicate work kind.

Examples:
- `[Case] Refund request awaiting approval`
- `[Change] Homepage redesign preview failed QA`
- `[Investigation] Incident diagnosis ready for review`

## 13.5 List columns

Work list recommended baseline columns:
- Kind
- Title
- Status
- Owner
- Priority
- Linked object summary
- Latest run state
- Pending approvals
- Updated time

## 13.6 Filters

Required filters:
- kind
- owner
- status
- priority
- has pending approvals
- has failed runs
- project
- linked system / object type

---

## 14. Naming and Language Rules

## 14.1 External product language

Use plain language first.

### Work kinds
- **Case** — handle something in the business
- **Change** — change something in the product/system
- **Investigation** — analyze something before action

### Other concepts
- **Run** — one execution attempt
- **Approval** — human decision required
- **Evidence** — what happened and why
- **Runtime** — the environment the agent worked in

## 14.2 Internal architecture language

It is acceptable internally to use:
- control plane
- execution plane
- adapter
- workflow/runbook
- WorkRuntime
- ExternalObjectRef
- evidence chain

## 14.3 Rule for product copy

Never make users learn architecture before they can use the product.

Lead with:
- what kind of work this is
- what is going to happen
- what needs approval
- what happened

---

## 15. Policy and Risk Semantics by Work Kind

Policy tiers remain shared:
- Auto
- Assisted
- Human-approve
- Manual-only

Work kind influences the **surface** and **common approval triggers**, but not the existence of the policy model.

## 15.1 Case common gates

Examples:
- send external communication
- mutate financial records
- update regulated information
- close/escalate customer issue with external impact

## 15.2 Change common gates

Examples:
- push code
- merge PR
- deploy to shared or production environment
- modify infrastructure
- publish public content
- delete or overwrite critical files

## 15.3 Investigation common gates

Examples:
- access sensitive data sources
- inspect production logs with personal data
- export/share findings externally
- auto-create follow-up actions without review

## 15.4 Core rule

Risk is determined by policy and action semantics, not by work kind label alone.

A Change may be low risk.
A Case may be high risk.
An Investigation may be sensitive.

---

## 16. User Journeys

## 16.1 Journey: Case

1. User creates or receives a Case.
2. Relevant records are linked.
3. Agent gathers context.
4. A Run prepares draft actions.
5. Plan is shown.
6. Approval may be required.
7. Approved actions execute.
8. Evidence log records the result.

## 16.2 Journey: Change

1. User creates a Change.
2. Repo/branch/runtime context is linked.
3. Runtime is provisioned if needed.
4. Agent performs edits, tests, previews, browser QA.
5. Plan/diff/preview are shown.
6. Approval may be required.
7. Allowed actions execute (push, PR, deploy, etc.).
8. Evidence log records the result.

## 16.3 Journey: Investigation

1. User creates an Investigation.
2. Sources/evidence targets are linked.
3. Agent gathers and analyzes material.
4. Findings are assembled.
5. Sensitive access or external reporting may require approval.
6. Final output is delivered as a diagnosis/report/recommendation.
7. Optional conversion into a Case or Change.

---

## 17. Conversion Flows

Work kinds should be able to produce follow-up work.

## 17.1 Investigation → Case

Example:
- Investigation finds customer follow-up is needed
- output creates a new Case with linked evidence

## 17.2 Investigation → Change

Example:
- website audit identifies required redesign changes
- output creates one or more Change items

## 17.3 Case → Change

Example:
- support issue reveals product bug
- Case creates a linked Change

## 17.4 Change → Case

Example:
- release completed, customer/stakeholder communication needed
- Change creates a linked Case

## 17.5 Rules for conversion

When converting:
- preserve evidence lineage
- preserve originating Work Item reference
- optionally carry forward linked object refs
- mark the new Work Item as “derived from” the previous one

```ts
export interface WorkItemRelationship {
  id: string
  fromWorkItemId: string
  toWorkItemId: string
  type: 'derived-from' | 'blocks' | 'related-to' | 'implements' | 'follows-up'
}
```

---

## 18. Cockpit / Mission Control Behavior

## 18.1 Core shell remains unified

Cockpit remains one operating surface.

It should not split into:
- a separate “ops app”
- a separate “dev app”
- a separate “research app”

Instead:
- one shell
- one inbox
- one approvals queue
- one evidence model
- kind-sensitive detail surfaces

## 18.2 Work item badges and affordances

Every work item card/row/detail page must show:
- kind badge
- status
- risk/policy summary
- latest run state
- pending approval count

## 18.3 Live detail view rule

The detail view should dynamically load the appropriate center pane(s) based on work kind, while preserving shared rails for:
- approvals
- evidence
- activity
- linked objects

## 18.4 Multi-runtime view for Change

Cockpit may later support tiling multiple Change runtimes across projects.

Use case:
- 4 tasks across 2 projects
- each task has its own runtime/browser/terminal
- all visible from one control surface

This is explicitly a **runtime orchestration and supervision** feature, not merely an embedded browser feature.

---

## 19. MVP Recommendations

## 19.1 Must-have MVP changes

1. add `WorkItem.kind`
2. support `case`, `change`, `investigation`
3. expose work kind in all lists/cards/inbox rows/detail views
4. update IA to include Cases / Changes / Investigations segmentation
5. add `WorkRuntime` as a first-class object for Change work
6. make Investigation able to exist without runtime, but allow runtime optionally
7. keep one common Run / Approval / Evidence model
8. update product copy and onboarding to explain the three work kinds simply

## 19.2 Strongly recommended for MVP

9. support Investigation → Case and Investigation → Change creation
10. support Case → Change linkage
11. support Change → Case linkage
12. support kind-specific empty states and create flows
13. show kind-aware approval copy and payload summaries

## 19.3 Defer until later

14. subtype taxonomy beyond optional strings
15. deeply customized vertical-pack-specific schemas
16. advanced runtime templates
17. full cloud runtime scheduling
18. sophisticated multi-pane tiling/mission wall UI

---

## 20. Migration Plan

## 20.1 Data migration

Existing generic Work Items must gain a kind.

### Strategy
- default unknown historical items to `investigation` only if they are clearly read-heavy and non-mutating
- otherwise require a migration heuristic or manual review
- if existing item is linked primarily to repo/branch/preview/deployment, infer `change`
- if linked primarily to CRM/helpdesk/customer/invoice/email-thread, infer `case`
- if insufficient signal, mark as `investigation` with a migration flag requiring review

## 20.2 UI migration

- add kind badge to current Work Item list and detail view
- add kind filter/tabs before full redesign
- then add kind-sensitive center panes

## 20.3 API migration

- add `kind` to Work Item create/read/update contracts
- preserve backward compatibility temporarily by defaulting omitted kinds via server-side rules during transition
- deprecate omitted `kind` once clients are migrated

## 20.4 Documentation migration

Update:
- README positioning examples
- architecture explanation examples
- Project UI plan
- Cockpit docs
- future ADRs

---

## 21. Open Questions

These do not block the model but should be resolved in follow-up ADRs/specs.

1. Final canonical term for runtime: `WorkRuntime` vs `MissionRuntime` vs `ExecutionCell`
2. Whether Investigation should default to read-only policy templates
3. Whether subtype should be freeform or controlled enum in core
4. Whether some Work Item create flows should be hidden unless relevant connectors/runtimes exist
5. How much of kind-specific layout belongs in core vs vertical-pack extension points

---

## 22. Final Decision Summary

### 22.1 What stays the same

- Portarium remains the control plane
- governance/execution split remains
- Workspace → Project → Work Item → Run → Approval → Evidence remains the backbone
- Project remains a lightweight grouping container
- one shell supports both solo and team use

### 22.2 What changes

- Work Item gains a first-class `kind`
- supported kinds are:
  - `case`
  - `change`
  - `investigation`
- the product explains work using these kinds
- Change work gets a first-class runtime model
- Cases and Investigations use kind-appropriate live surfaces
- all kinds share one governance model

### 22.3 Product sentence

**Portarium governs work. Work lives inside Projects. Each work item is a Case, a Change, or an Investigation. All of them use the same approvals, policy, runs, and evidence model; only the execution substrate and live surface differ.**

---

## 23. Concise Glossary

- **Workspace** — tenant-level container for people, policy, credentials, evidence governance, connectors
- **Project** — lightweight grouping scope
- **Work Item** — one unit of work in a project
- **Case** — record-centric business work
- **Change** — workspace-centric artifact/system work
- **Investigation** — read-heavy analytical work
- **Run** — one execution attempt
- **Plan** — what Portarium intends to do
- **Approval Gate** — human decision point
- **Evidence Log** — linked record of what happened and why
- **WorkRuntime** — isolated execution environment, mainly for Change work
- **ExternalObjectRef** — deep-linked reference to a record, repo, deployment, thread, or other external object

---

## 24. Recommended Follow-up Specs

1. ADR: canonical runtime naming and responsibilities
2. Spec: Work Item API contract updates
3. Spec: kind-aware Cockpit IA and routing
4. Spec: Change runtime lifecycle and supervisor daemon
5. Spec: Investigation output schema and conversion flows
6. Spec: migration heuristics for existing Work Items
