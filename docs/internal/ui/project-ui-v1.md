# Default Project UI (v1) - UX/UI Plan

Portarium is a control plane. The default UI should feel like an operations cockpit: risk-forward, evidence-first, and collaboration-ready, without becoming "team-only" (a Workspace can be a team or a single person).

This document describes the initial UX and UI structure for the **Project (Container)** experience.

## Goals

- One UI that works for both individuals and teams:
  - A "solo Workspace" is a valid Workspace with 1 user.
  - Team features (RBAC, approvals, assignment) exist but do not block solo usage.
- Make the "what will change" and "what happened" story legible:
  - Plans are reviewable before execution.
  - Evidence is easy to audit after execution.
- Optimize for control-plane tasks:
  - Start workflows/runbooks, monitor Runs, handle Approval Gates, and review Evidence.

## Prototype (low-fi)

A clickable low-fidelity prototype is available in `docs/internal/ui/lofi/`.

- Entry: `docs/internal/ui/lofi/index.html`
- Usage: use the top controls to simulate persona defaults, Workspace type (solo/team), and system states.

## Default Landing + Navigation Rules (v1)

- Default landing is the **Workspace Inbox**, not a Project.
  - Rationale: operators and approvers start from "what needs attention" (Approval Gates, failures, violations).
- A **Project** is a scope and grouping tool:
  - You can do everything from Workspace surfaces, then filter/scope to a Project when helpful.
- Deep links must preserve context:
  - Entering from Inbox (e.g., Approval Gate) should link into the relevant Run/Work Item and allow returning to Inbox.
- Collaboration is optional, not required:
  - If ownership/assignment is not used, the UI still functions with "created by" and "recent activity."

## Non-goals (v1)

- Full visual design system specification (tokens, typography, full component library).
- Full Vertical Pack UI templating system (but v1 should not block it).
- Heavy project-management features (Projects are lightweight containers; Work Items are the unit of work).

## Core Concepts (UI Mental Model)

- **Workspace / Tenant**: where users, roles (RBAC), policies, credentials, and evidence live.
- **Project (Container)**: lightweight grouping of Work Items and their Runs/Evidence.
- **Work Item**: the cross-system "case binder" connecting ExternalObjectRefs, Runs, Approvals, and Evidence.
- **Workflow / Runbook**: the durable procedure.
- **Run**: one execution instance of a workflow.
- **Plan**: structured intended effects (Planned Effects); approvals sign off on the Plan.
- **Approval Gate**: the pause requiring a human decision.
- **Evidence Log**: append-only timeline of events (Plan/Action/Approval/Policy/System) plus linked payloads.

## Principle: "Teams and Individuals Use the Same UI"

The UI does not have "team mode" vs "personal mode". It has:

- The same objects and navigation.
- Different defaults:
  - Solo default filters: "Assigned to me", "My approvals", "My recent runs".
  - Team default filters: "Assigned to my team", "Unassigned", "Pending approvals".
- Progressive disclosure for collaboration features:
  - Show assignment/mentions/roles in the UI, but do not require them to create value.
  - Approval Gate UI must handle 1-approver (solo) and N-approver / SoD constraints (teams).

### Solo vs Team UX Rules (v1)

- Solo Workspaces:
  - Default owner on new Work Items is the current user.
  - Approval Gates are still shown, but if maker-checker / SoD requires a distinct approver, the UI must clearly say "cannot self-approve" and what to do next.
- Team Workspaces:
  - Surface "unassigned" and queue health prominently (especially Approvals and Work Items).
  - Always show the actor identity on Evidence entries (User/Machine/Adapter/System) to support accountability.

## Role Defaults (v1)

The UI should feel coherent because defaults differ by persona. This is not separate "modes"; it is default filters, navigation order, and copy.

| Persona  | Primary surface defaults                                        | Primary actions                                            | Notes                                                    |
| -------- | --------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| Operator | Inbox: run failures, blocked Runs, Work Items needing attention | Start workflow/runbook, retry run, link ExternalObjectRefs | Optimize for throughput and clarity on "what to do next" |
| Approver | Inbox: pending Approval Gates (assigned to me)                  | Approve/deny/request changes with rationale                | Must see Plan + policy context first, payloads second    |
| Auditor  | Evidence (Project/Workspace) with verification affordances      | Filter, export verification bundle/report                  | Read-first; commands likely restricted                   |
| Admin    | Workspace settings entry points                                 | Manage RBAC, policies, credentials, adapters/providers     | Needs strong "impact and blast radius" explanations      |

## Information Architecture

### Global (Workspace-level) surfaces

- Workspace switcher (top left).
- Inbox (default landing; approvals, failures, violations, mentions/assignments).
- Global search (Work Items, Runs, Evidence, ExternalObjectRefs).
- Notifications (secondary; mirrors Inbox items for quick access).
- Workspace settings (RBAC, credential vaulting, adapters/providers, policies).

### Project-level navigation (primary experience)

Within a Project:

- Overview
- Work Items
- Runs
- Approvals
- Evidence
- Project settings

Notes:

- "Integrations" (adapters/providers) and "Policies" are primarily Workspace-level, but the Project UI should deep-link into the relevant Workspace settings views and show effective policy context on Work Items/Runs.

## Default Screens (v1)

## Primary User Journeys (v1)

These journeys are intentionally identical for teams and individuals; collaboration steps become optional or are satisfied by the same person in solo Workspaces.

### Journey A: Create Work Item -> Start Run -> Review Evidence (solo or operator)

1. From Project Overview, select "Create Work Item".
2. Attach ExternalObjectRefs (deep links to relevant SoR entities).
3. Start a workflow/runbook.
4. Review the Plan (Planned Effects).
5. If an Approval Gate is required, decide (approve/deny/request changes).
6. Monitor Run to completion.
7. Confirm Verified Effects and inspect Evidence entries and payloads.

### Journey B: Maker-checker Approval Gate (team)

1. Operator starts a workflow/runbook from a Work Item.
2. Run pauses at an Approval Gate with a Plan to approve.
3. Approver reviews Plan summary, effects, and policy context (tier, scopes, SoD).
4. Approver decides and provides rationale.
5. Operator (or system) resumes execution; Evidence Log records approval and outcomes.

### Journey C: Audit a Project (auditor)

1. Navigate to Project Evidence.
2. Filter by Work Item and category (Plan/Approval/Action/System).
3. Verify a contiguous hash chain segment and spot-check key entries.
4. Export a verification report or evidence bundle (v1: minimal; expand later).

## Center Of Gravity: Work Item Detail (v1)

To avoid duplicate "detail pages that all feel like dashboards," v1 should treat **Work Item Detail** as the primary hub.

- Work Item Detail contains the unified story: ExternalObjectRefs + Runs + Approval Gates + Evidence.
- Run Detail exists as a focused view for execution debugging and deep evidence, and always links back to its Work Item.

### 1) Project Overview

Purpose: answer "what needs attention" in 10 seconds.

- Counters:
  - Work Items needing attention (blocked, SLA breach risk, unassigned)
  - Runs in progress / failed in last 24h
  - Pending approvals
- "Health and risk" summary:
  - Effective Execution Tier distribution (Auto/Assisted/Human-approve/Manual-only)
  - Top policy violations (if any)
- Quick actions:
  - Create Work Item
  - Start workflow/runbook (guided)

### 2) Work Items List

Primary table/list with fast filtering and keyboard-friendly navigation.

- Columns (initial):
  - Title + status
  - Owner
  - Linked SoRs (ExternalObjectRefs as chips)
  - Latest Run status
  - Pending approvals count
  - Updated time
- Filters:
  - Owner (me, unassigned, user)
  - Status
  - Port Family / SoR (derived from ExternalObjectRefs)
  - "Has pending approvals", "Has failed runs"
- Empty state:
  - Explain what a Work Item is (binder for links + Runs + Evidence).
  - CTA: "Create Work Item" and "Import/link from SoR".

### 3) Work Item Detail

This is the default "single pane" where operators and auditors converge.

- Header:
  - Title, status, owner, tags
  - Effective policy summary (Execution Tier expectations, SoD constraints if relevant)
- ExternalObjectRefs section:
  - Chips with `sorName`, `externalType`, `displayLabel`, deep link
- Activity timeline (merged view):
  - Evidence entries (Plan/Action/Approval/Policy/System)
  - Runs (start, step highlights, completion)
  - Human notes (v1 optional; if present, treat as Evidence category System or separate "Notes" tab)
- Primary actions:
  - Start workflow/runbook (context-aware)
  - Request approval (if manual plan creation exists)
  - Attach ExternalObjectRef
- Tabs/panels (v1):
  - Runs (list + link to Run Detail)
  - Approvals (pending + resolved, scoped to this Work Item)
  - Evidence (scoped to this Work Item; with filters)

### 4) Runs List + Run Detail

Runs are the operational heartbeat. UI must make status and causality obvious.

Run list:

- Filters: status, workflow/runbook, time window, Work Item, owner/initiator
- Row: status, workflow name, Work Item link, approvals pending, started/ended timestamps

Run detail:

- Status + timeline (queued -> running -> paused at Approval Gate -> succeeded/failed)
- Plan panel:
  - Planned Effects (always)
  - Predicted Effects (only if present; never shown as "will happen")
  - Verified Effects (when available post-run; drawn from evidence)
- Approval Gate panel (when paused):
  - What decision is needed and why (policy, tier, scopes)
  - Approve / deny / request changes (with rationale text)
  - Show SoD constraint evaluation (maker-checker, N-approvers)
- Evidence panel:
  - Evidence entries scoped to the Run, with links to payloads (logs/diffs/artifacts)
- Failure handling:
  - Show "what failed" + recommended next action (retry, roll forward, manual-only)
  - Link to idempotency key context when relevant

### 5) Approvals

This is a first-class queue, not an afterthought.

- List:
  - Pending approvals assigned to me
  - Pending approvals for the Project (if permitted)
- Approval detail:
  - Plan summary and effects list
  - Policy context (tier, required approvals, scopes)
  - ExternalObjectRefs and deep links
  - Decision actions with required rationale

### 6) Evidence

Evidence is the audit backbone. The UI should make it explorable and verifiable.

- Default view: timeline with filters:
  - Category: Plan/Action/Approval/Policy/System
  - Actor: User/Machine/Adapter/System
  - Linked object: Work Item / Run / Plan
- Tamper-evident affordances:
  - Show "chain verified" badge for a contiguous range
  - Allow exporting a verification report (v1: UI stub + JSON download later)

## System States (v1)

Every primary surface needs explicit handling for these states, with a clear "next action" and a return path:

- Empty:
  - No Work Items in Project, no Runs yet.
- Misconfigured:
  - No adapter/provider selected for a port; missing credentials; missing scopes.
- Policy blocked:
  - Execution Tier is Manual-only or requires additional approvals; show the rule and remediation.
- Permission limited (RBAC):
  - User can view but cannot act; show why and who can grant access.
- Degraded realtime:
  - Event stream unavailable; UI falls back to polling and communicates staleness.

## Key Interaction Patterns

- Progressive disclosure:
  - Summary first, drill into payloads only when needed.
- Consistent "diff language":
  - Always separate Planned vs Verified effects; show Predicted only when credible.
- Deep-link everything:
  - ExternalObjectRefs should always provide a safe deep link to the SoR entity when available.
- Permission clarity:
  - If an action is unavailable, show the reason (RBAC, policy tier, missing provider capability).

## Effects Presentation Rules (v1)

Effects are the core trust UI. Use one consistent component everywhere (Run Detail, Approval detail, Work Item hub).

- Always render sections in this order:
  - Planned Effects
  - Predicted Effects (optional)
  - Verified Effects (post-run)
- Copy rules:
  - Planned: "Portarium intends to..."
  - Predicted: "The provider preview suggests..." (never "will")
  - Verified: "Observed change"
- Each effect row shows:
  - operation (Create/Update/Delete/Upsert)
  - target (ExternalObjectRef)
  - one-line summary
  - idempotency context when available (idempotency key or "retry-safe" cue)

## Content and Naming

- Use glossary terms in UI labels:
  - "Work Item" (not case/issue)
  - "Run" (not job/execution)
  - "Approval Gate" (not approval step)
  - "Plan" (not preview/proposal)
  - "Evidence Log" (not audit trail)
- One-line summaries should be written as outcomes:
  - "Create Invoice in NetSuite", "Update Ticket priority in Zendesk"

## Accessibility and QA (v1 bar)

- Keyboard navigable main surfaces (lists, detail pages, approval decisions).
- Visible focus states; no color-only status encoding.
- Screen-reader friendly status and timeline semantics.
- For UI/user-flow changes: use the `/qa-agent-browser` process and attach traces/screenshots (project rule).

## Implementation Notes (non-binding)

- UI consumes:
  - Queries API for list/detail views.
  - Commands API for starting workflows and submitting approval decisions.
  - Event stream for realtime run/evidence updates (optional in v1; polling acceptable).
- Prefer a "core shell" + extension points so Vertical Packs can add:
  - Workflow templates, Work Item fields, and domain-specific views.

## Open Questions (to resolve before high-fidelity design)

- Who are the primary personas we optimize for first: Operator, Approver, Auditor, Admin?
- What is the MVP scope inside a Project: Work Items + Runs + Approvals + Evidence only, or include project settings and policies in v1?
- What evidence export formats are required for MVP (JSON only, PDF report, signed bundle)?
