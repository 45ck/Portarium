# Cockpit Prototype -- Plan Alignment Audit

**Date**: 2026-02-17
**Scope**: Compare `docs/internal/ui/cockpit/index.html` against all `.specify/specs/*.md` and `docs/internal/adr/*.md`
**Method**: Manual cross-reference of every spec field, state, lifecycle, and domain concept against prototype screens

---

## 1. Coverage Matrix

| Domain Concept                                                 | Spec Source                    | Cockpit Screen(s)                                                               | Status                                        |
| -------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------- |
| **Work Item** (binding object)                                 | work-item-v1, ADR-0038         | Work Items list, Work Item detail                                               | **Present**                                   |
| WorkItem.status (Open / Closed)                                | work-item-v1                   | Work Items table shows Open, Completed but also "In progress", "Needs approval" | **Mismatch** -- see S6.1                      |
| WorkItem.sla / dueAtIso                                        | work-item-v1                   | Not shown on any screen                                                         | **Missing**                                   |
| WorkItem.links.externalRefs                                    | work-item-v1                   | Work Item detail: Linked External Records chip cluster                          | **Present**                                   |
| WorkItem.links.runIds / approvalIds / evidenceIds              | work-item-v1                   | Work Item detail tabs (Runs, Approvals, Evidence)                               | **Present**                                   |
| **Run** (execution instance)                                   | run-v1                         | Runs list, Run detail, Inbox failures                                           | **Present**                                   |
| Run.status (7 states)                                          | run-v1                         | See S4.1 for gap                                                                | **Partial**                                   |
| Run.correlationId                                              | run-v1                         | Not surfaced in UI                                                              | **Missing**                                   |
| Run.executionTier                                              | run-v1                         | Shown as tier badge                                                             | **Present**                                   |
| Run.startedAtIso / endedAtIso                                  | run-v1                         | Shown as relative time ("12m ago")                                              | **Partial** -- no absolute timestamps         |
| **Approval** (gate decision)                                   | approval-v1                    | Approvals screen, Run detail gate panel, Triage view                            | **Present**                                   |
| Approval.status (Pending / Approved / Denied / RequestChanges) | approval-v1                    | Decision dropdown + triage actions                                              | **Present**                                   |
| Approval.rationale (required)                                  | approval-v1                    | Rationale textarea on Run detail                                                | **Present**                                   |
| Approval.assigneeUserId                                        | approval-v1                    | Filters show "Assigned to me", but no assign-to-user UI                         | **Partial**                                   |
| Approval.dueAtIso (SLA timer)                                  | approval-v1                    | Not shown                                                                       | **Missing**                                   |
| Approval.prompt                                                | approval-v1                    | Shown as card title / triage card title                                         | **Present**                                   |
| **Evidence** (append-only)                                     | evidence-v1, ADR-0028/0029     | Evidence screen, Run detail evidence list                                       | **Present**                                   |
| Evidence.category (Plan / Action / Approval / Policy / System) | evidence-v1                    | Shown in entry subtitles                                                        | **Present**                                   |
| Evidence.actor (User / Machine / Adapter / System)             | evidence-v1                    | Shown in entry subtitles                                                        | **Present**                                   |
| Evidence.hashSha256 / previousHash                             | evidence-v1                    | Chain integrity banner; individual hashes not shown                             | **Partial**                                   |
| Evidence.payloadRefs (Artifact / Snapshot / Diff / Log)        | evidence-v1                    | "payloadRefs: Diff, Log" shown in one entry                                     | **Partial** -- no download/view               |
| **Plan** (structured intended effects)                         | plan-v1, ADR-0027              | Work Item detail effects, Run detail effects                                    | **Present**                                   |
| Plan.plannedEffects                                            | plan-v1                        | Effects section: Planned Effects                                                | **Present**                                   |
| Plan.predictedEffects + confidence                             | plan-v1                        | Run detail: Predicted Effects with confidence 0.82                              | **Present**                                   |
| Verified Effects (post-run)                                    | plan-v1 + evidence-v1          | Shown as placeholder "Not available yet"                                        | **Present**                                   |
| Plan.planId                                                    | plan-v1                        | Shown as "Plan P-551" in evidence links                                         | **Present**                                   |
| **Workflow** (runbook definition)                              | workflow-v1                    | Workflow Builder screen                                                         | **Present**                                   |
| Workflow.version                                               | workflow-v1                    | Not shown in builder or run detail                                              | **Missing**                                   |
| Workflow.active (boolean)                                      | workflow-v1                    | Not shown / no toggle                                                           | **Missing**                                   |
| Workflow.actions (ordered, contiguous)                         | workflow-v1                    | Builder canvas shows ordered nodes                                              | **Present**                                   |
| WorkflowAction.portFamily                                      | workflow-v1                    | Shown as port-icon badges on nodes                                              | **Present**                                   |
| WorkflowAction.executionTierOverride                           | workflow-v1                    | Config panel has "Automation Level" dropdown                                    | **Present**                                   |
| **Policy** (SoD constraints)                                   | policy-v1, ADR-0031            | Settings > Policies, Inbox violations, Run detail                               | **Present**                                   |
| Policy.sodConstraints.MakerChecker                             | policy-v1                      | SoD badge "maker-checker" + callouts                                            | **Present**                                   |
| Policy.sodConstraints.DistinctApprovers                        | policy-v1                      | "N-approvers: 2" shown; no editing UI                                           | **Partial**                                   |
| Policy.sodConstraints.IncompatibleDuties                       | policy-v1                      | Not shown anywhere                                                              | **Missing**                                   |
| **Port** (registry)                                            | port-v1                        | Settings > Adapters/Providers                                                   | **Partial**                                   |
| Port.status (Active / Inactive / Disabled)                     | port-v1                        | Shown as "Configured" or "Missing" -- not spec states                           | **Mismatch**                                  |
| Port.supportedOperations                                       | port-v1                        | Capability Matrix grid shows operations                                         | **Partial**                                   |
| Port.auth (mode, scopes)                                       | port-v1                        | Scopes shown in credentials; auth mode not explicit                             | **Partial**                                   |
| **Credential Grant**                                           | credential-grant-v1            | Settings > Credentials                                                          | **Partial**                                   |
| CredentialGrant.expiresAtIso                                   | credential-grant-v1            | "Expires: 2026-06-01" shown                                                     | **Present**                                   |
| CredentialGrant.lastRotatedAtIso                               | credential-grant-v1            | Not shown                                                                       | **Missing**                                   |
| CredentialGrant.revokedAtIso                                   | credential-grant-v1            | No revoke UI / status                                                           | **Missing**                                   |
| CredentialGrant.scope                                          | credential-grant-v1            | "Scopes: charges.read, charges.write" shown                                     | **Present**                                   |
| Rotate / Revoke operations                                     | credential-grant-v1            | "Rotate" button present; no "Revoke" button                                     | **Partial**                                   |
| **Adapter Registration**                                       | adapter-registration-v1        | Settings > Adapters/Providers                                                   | **Partial**                                   |
| AdapterRegistration.providerSlug                               | adapter-registration-v1        | "Provider: Stripe" shown                                                        | **Present**                                   |
| AdapterRegistration.enabled                                    | adapter-registration-v1        | No enable/disable toggle                                                        | **Missing**                                   |
| AdapterRegistration.capabilityMatrix                           | adapter-registration-v1        | Capability Matrix grid for Stripe                                               | **Present**                                   |
| AdapterRegistration.machineRegistrations                       | adapter-registration-v1        | Not shown                                                                       | **Missing**                                   |
| **IAM MVP** (AuthN + RBAC)                                     | iam-mvp                        | Settings > RBAC, Persona switcher                                               | **Present**                                   |
| WorkspaceUserRole (admin/operator/approver/auditor)            | iam-mvp                        | Persona dropdown + RBAC list                                                    | **Present**                                   |
| Action matrix enforcement                                      | iam-mvp                        | RBAC-limited banner; persona-based UI changes                                   | **Present**                                   |
| User.active (boolean)                                          | control-plane-api-v1           | "Active" status shown                                                           | **Present**                                   |
| User.email (unique)                                            | control-plane-api-v1           | Emails shown in RBAC list                                                       | **Present**                                   |
| **Control Plane API**                                          | control-plane-api-v1, ADR-0043 | N/A (backend contract)                                                          | N/A                                           |
| Pagination (cursor-based)                                      | control-plane-api-v1           | No pagination controls on any list                                              | **Missing**                                   |
| Error display (RFC 7807)                                       | control-plane-api-v1           | No structured error display                                                     | **Missing**                                   |
| **Vertical Packs**                                             | vertical-packs, ADR-0040       | Not present                                                                     | **Missing**                                   |
| Pack Manifest / lockfile / resolver                            | vertical-packs                 | No UI surface                                                                   | **Missing**                                   |
| **Domain Events**                                              | domain-event-v1                | Not directly surfaced                                                           | **Partial** -- status bar "Events: connected" |
| Event stream (CloudEvents)                                     | ADR-0032                       | Status bar indicator only                                                       | **Partial**                                   |
| **Evidence Retention Policy**                                  | evidence-retention-policy-v1   | Retention tags on evidence entries                                              | **Partial**                                   |
| Retention classes (Operational/Compliance/Forensic)            | evidence-retention-policy-v1   | Not shown; tags show "active 365d"                                              | **Missing**                                   |
| Legal hold                                                     | evidence-retention-policy-v1   | Not shown                                                                       | **Missing**                                   |
| Disposition workflow                                           | evidence-retention-policy-v1   | "payload purged" tag shown; no manage UI                                        | **Partial**                                   |
| **Quota Semantics**                                            | quota-semantics-v1, ADR-0030   | Not surfaced                                                                    | **Missing**                                   |
| RateLimit / DailyCap / Batching / RetryAfter                   | quota-semantics-v1             | Not shown in capability matrix or run detail                                    | **Missing**                                   |
| **Canonical Objects** (14 types)                               | canonical-objects-v1           | Evidence > Linked Objects (Invoice, Charge, Ticket)                             | **Partial**                                   |
| Full canonical object detail                                   | canonical-objects-v1           | Mini-cards with summary only                                                    | **Partial**                                   |
| **Observability** (OpenTelemetry)                              | ADR-0033                       | Not surfaced                                                                    | **Missing**                                   |
| **Untrusted Execution Containment**                            | ADR-0034                       | Not surfaced                                                                    | **Missing** (operational, not UI)             |
| **Port Taxonomy** (18 families)                                | ADR-0026, glossary             | 4 families shown (FA, PB, CS, CR)                                               | **Partial**                                   |
| **UI Templating** (pack-driven)                                | ADR-0048                       | Not implemented                                                                 | **Missing**                                   |

---

## 2. Missing Concepts

### 2.1 Vertical Packs (High Priority)

No UI surface exists for vertical pack management despite being a core extensibility mechanism (vertical-packs spec, ADR-0040, ADR-0044 through 0055). Missing:

- Pack marketplace / registry browser
- Enabled packs per workspace
- Pack version pinning / lockfile viewer
- Pack upgrade workflow
- Pack dependency visualization

### 2.2 Quota Semantics (Medium Priority)

The quota-semantics-v1 spec defines rate limiting, daily caps, batching, and retry-after behavior per action. None of this is surfaced:

- No quota usage indicators in Run detail or Capability Matrix
- No quota-driven scheduling visibility
- No "deferred due to quota" run status explanation
- Capability Matrix grid does not show quota columns

### 2.3 Evidence Retention Management (Medium Priority)

The evidence-retention-policy-v1 spec defines retention classes, legal holds, and disposition workflows. Currently:

- No UI to configure retention durations per class (Operational/Compliance/Forensic)
- No legal hold management (apply/release/view)
- No disposition queue or approval workflow
- Retention class names are not shown (just "active 365d")

### 2.4 Domain Event Stream Viewer (Low-Medium Priority)

The domain-event-v1 spec and ADR-0032 (CloudEvents) describe a rich event system. The UI only shows a status bar indicator ("Events: connected"). Missing:

- Real-time event feed / stream viewer
- Event filtering by aggregate, type, correlation ID
- Event payload inspection
- Event stream health/lag indicators

### 2.5 Observability / Tracing (Low Priority)

ADR-0033 adopts OpenTelemetry. No UI surface for:

- Trace viewer linked to runs
- Performance metrics dashboard (run duration, action success rates, approval latency)
- Quota utilisation metrics
- "Bring your own dashboard" export configuration

### 2.6 Machine Registrations (Medium Priority)

The adapter-registration-v1 spec includes `machineRegistrations` for autonomous agents. The Agents screen shows AI agents but does not cover machine registrations as defined in the spec (endpointUrl, active, authHint). There is a conceptual overlap between the "Agents" screen and spec-defined "Machines" that needs clarification.

### 2.7 Correlation ID Surface (Low Priority)

Run.correlationId is defined in run-v1 and referenced in domain-event-v1 and evidence. It enables cross-run tracing but is never shown in the UI.

---

## 3. Terminology Mismatches

| UI Term                                                       | Spec/Glossary Term                              | Location                           | Severity                                                                                                             |
| ------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| "Agents" (sidebar, screen)                                    | "Machine Registration" or "Machine"             | Sidebar, Agents screen             | **Medium** -- glossary defines Machine as artifact-producer; the UI shows LLM-based agents which are not in any spec |
| "Start workflow" (button)                                     | "Start Run" (from a Workflow)                   | Inbox CTA, sidebar                 | **Low** -- spec distinguishes workflow definition from run instance                                                  |
| "In progress" (work item status)                              | Work Item has only `Open` / `Closed`            | Work Items table                   | **High** -- spec violation (see S6.1)                                                                                |
| "Needs approval" (work item status)                           | Not a valid WorkItem.status                     | Work Items table                   | **High** -- spec violation (see S6.1)                                                                                |
| "Completed" (work item status)                                | "Closed" in spec                                | Work Items table                   | **Medium** -- should be "Closed"                                                                                     |
| "Paused" (run status)                                         | "WaitingForApproval" in spec                    | Runs table, Run detail             | **Medium** -- spec uses WaitingForApproval                                                                           |
| "Runbook" (various)                                           | "Workflow" in spec                              | Project Overview, Work Item detail | **Low** -- glossary lists "Workflow / Runbook" as synonyms                                                           |
| "Provider" / "Select provider"                                | "Adapter Registration" in spec                  | Settings > Adapters                | **Low** -- glossary defines provider as the vendor, adapter as the implementation                                    |
| "Automation Level" (workflow builder)                         | "Execution Tier" in spec/glossary               | Workflow Builder config panel      | **Medium** -- glossary says "Execution Tier"                                                                         |
| "Configured" / "Missing" (port status)                        | Port.status: `Active` / `Inactive` / `Disabled` | Settings > Adapters                | **Medium** -- uses non-spec status values                                                                            |
| "Project" (navigation, breadcrumbs)                           | "Project (Container)" in glossary               | Sidebar, breadcrumbs               | **Low** -- aligned but Project is not a spec entity                                                                  |
| "Category" (evidence filter chip)                             | `category` is correct spec term                 | Evidence screen                    | **OK**                                                                                                               |
| "tier-badge" labels (Auto/Assisted/Human-approve/Manual-only) | ExecutionTier values                            | Throughout                         | **OK** -- aligned                                                                                                    |

---

## 4. State/Lifecycle Gaps

### 4.1 RunStatus Lifecycle

**Spec (run-v1)**: `Pending -> Running -> WaitingForApproval -> Paused -> Succeeded -> Failed -> Cancelled`

**UI coverage**:

- Pending: Not shown in any table row
- Running: Shown (Runs table R-8892)
- WaitingForApproval: Shown as "Paused" -- **terminology mismatch**
- Paused: Shown but conflated with WaitingForApproval
- Succeeded: Shown
- Failed: Shown
- Cancelled: **Not shown anywhere** -- no cancel action or cancelled state display

**Gap**: The UI does not distinguish between `WaitingForApproval` and `Paused`. The spec lists these as separate states. A Run can be paused for reasons other than approval (e.g., quota, manual hold). The UI also has no "Cancel Run" button or "Cancelled" status display.

### 4.2 WorkItem Status Lifecycle

**Spec (work-item-v1)**: `Open | Closed` (two states only)

**UI shows**: Open, In progress, Needs approval, Completed (with drift badge)

**Gap**: The UI has invented intermediate statuses that do not exist in the spec. Work Items are intentionally thin binding objects with only Open/Closed. The intermediate states shown (In progress, Needs approval) appear to be derived from linked Run statuses, but the UI presents them as WorkItem statuses, which contradicts the spec.

### 4.3 ApprovalStatus Lifecycle

**Spec (approval-v1)**: `Pending -> Approved | Denied | RequestChanges`

**UI coverage**: All four states are represented in the approval decision flow. The triage view supports Approve, Deny, Request Changes, and Skip (Skip is a UI-only concept not in the spec, which is fine for UX). **No significant gap.**

### 4.4 Port Status Lifecycle

**Spec (port-v1)**: `Active | Inactive | Disabled`

**UI shows**: "Configured" and "Missing"

**Gap**: These are not spec states. "Configured" maps loosely to Active, but Inactive and Disabled are not represented.

### 4.5 CredentialGrant Lifecycle

**Spec (credential-grant-v1)**: issued -> rotated -> revoked (with timestamp ordering)

**UI shows**: Valid, Expiring -- no revoked state, no rotation history, no revoke action.

### 4.6 Workflow Lifecycle

**Spec (workflow-v1)**: active (boolean), version (integer >= 1)

**UI shows**: No version number, no active/inactive toggle, no version history. The Workflow Builder shows a single draft with no lifecycle management.

---

## 5. Feature Gaps

### 5.1 Pagination (All List Screens)

The control-plane-api-v1 spec defines cursor-based pagination. No list screen (Work Items, Runs, Approvals, Evidence) has pagination controls (next/previous, page size, or infinite scroll indicators).

### 5.2 Approval Assignment

The approval-v1 spec has `assigneeUserId` (optional). The Inbox shows "Assign approver" as an action, but there is no actual UI to select and assign a user to an approval. The approvals table has no "Assignee" column.

### 5.3 Approval SLA Timer

The approval-v1 spec has `dueAtIso` for SLA timing. The workflow builder has a "Timeout" dropdown (1h/24h/7d), but the approvals screen and triage cards do not show time remaining or due dates.

### 5.4 Work Item SLA

The work-item-v1 spec has `sla.dueAtIso`. No Work Item screen shows SLA/due date information.

### 5.5 Credential Revocation

The credential-grant-v1 spec defines revoke and rotate operations. The Settings screen has a "Rotate" button but no "Revoke" button and no revocation status display.

### 5.6 Adapter Enable/Disable

The adapter-registration-v1 spec has an `enabled` boolean. The Settings > Adapters screen shows no toggle to enable/disable adapters.

### 5.7 Capability Matrix Completeness

The adapter-registration-v1 spec requires a complete capability matrix with `operation` (noun:action format), `requiresAuth`, `inputKind`, `outputKind`. The UI grid shows a simplified view (Object, Read/Write/Webhook/Idempotency/Plan-Diff/Reversible) that does not map to the spec schema.

### 5.8 Workflow Version Management

The workflow-v1 spec has `version` (integer >= 1) and `active` (boolean). The Workflow Builder has no version indicator, no version history, and no activate/deactivate workflow action.

### 5.9 Evidence Verification Detail

The evidence-v1 spec defines hash chaining and verification. The UI shows a chain integrity banner but does not allow individual entry hash inspection or re-verification.

### 5.10 Evidence Payload Download/View

Evidence entries reference payloads (Artifact, Snapshot, Diff, Log). The UI mentions payloadRefs but provides no download or inspection mechanism.

### 5.11 IncompatibleDuties Policy

The policy-v1 spec defines three SoD constraint types. The UI shows MakerChecker and DistinctApprovers (as N-approvers) but does not surface IncompatibleDuties constraints.

### 5.12 Vertical Pack Management

No UI exists for the entire vertical packs subsystem (vertical-packs spec, ADR-0040 through 0055).

### 5.13 Canonical Object Detail View

The evidence screen shows mini-cards for linked objects (Invoice, Charge, Ticket). There is no dedicated canonical object detail view or navigation to explore objects across the 14 canonical types.

### 5.14 Bulk Operations

No bulk select/action on any list screen (bulk approve, bulk close work items, bulk retry runs).

---

## 6. Spec Violations

### 6.1 WorkItem Status Values (Critical)

**Spec**: `status: Open | Closed` (work-item-v1, line 19)
**UI**: Shows "In progress", "Needs approval", "Completed" as work item statuses in the Work Items table

This directly contradicts the spec. Work Items are thin binding objects with only two status values. The additional statuses appear to be derived from linked Run state and should be presented as derived/computed metadata (e.g., as a separate "Activity" column), not as the WorkItem.status field.

**Recommendation**: Change the Work Items table "Status" column to show only Open/Closed. Add a separate "Activity" or "Latest Run" column that shows derived state (has pending approval, has failed run, etc.).

### 6.2 RunStatus "Paused" vs "WaitingForApproval" Conflation (Medium)

**Spec**: RunStatus has both `WaitingForApproval` and `Paused` as distinct states (run-v1, lines 31-32)
**UI**: Uses "Paused" to represent what appears to be `WaitingForApproval`

The Run detail header says "Paused at Approval Gate" and the state machine shows "Approval Gate" as the active step. This is actually `WaitingForApproval`, not `Paused`.

**Recommendation**: Use "Waiting for Approval" label when Run.status is WaitingForApproval. Reserve "Paused" for the distinct Paused state (e.g., manual pause, quota pause).

### 6.3 Port Status Values (Low-Medium)

**Spec**: Port.status is `Active | Inactive | Disabled` (port-v1, line 17)
**UI**: Shows "Configured" and "Missing"

**Recommendation**: Use spec-defined status values. "Missing" can be shown when no port/adapter exists for a family, but existing ports should show Active/Inactive/Disabled.

---

## 7. Recommendations (Prioritized)

### P0 -- Spec Violations (Fix Before Any Release)

1. **Fix WorkItem status values** (S6.1)
   - Location: Work Items table, Work Items kanban
   - Change: Status column shows only Open/Closed; add derived "Activity" column

2. **Fix RunStatus labels** (S6.2)
   - Location: Runs table, Run detail header, Work Item Runs tab
   - Change: Use "Waiting for Approval" instead of "Paused" for that state; add "Cancelled" state

3. **Fix Port status labels** (S6.3)
   - Location: Settings > Adapters/Providers
   - Change: Use Active/Inactive/Disabled per spec

4. **Rename "Automation Level" to "Execution Tier"** (S3)
   - Location: Workflow Builder config panel
   - Change: Use spec terminology consistently

### P1 -- Critical Missing Features

5. **Add pagination controls** (S5.1)
   - Location: All list/table screens (Work Items, Runs, Approvals, Evidence)
   - Add: Next/prev, page size selector, total count

6. **Add approval SLA timers** (S5.3)
   - Location: Approvals table, triage cards, Run detail gate panel
   - Add: Due date, time remaining, overdue indicator

7. **Add Work Item SLA display** (S5.4)
   - Location: Work Items table, Work Item detail
   - Add: Due date column, SLA countdown

8. **Add workflow version management** (S5.8)
   - Location: Workflow Builder
   - Add: Version number display, version history, activate/deactivate toggle

9. **Add credential revoke action** (S5.5)
   - Location: Settings > Credentials
   - Add: Revoke button, revoked status, rotation history

10. **Add approval assignment UI** (S5.2)
    - Location: Approvals screen, Work Item approvals tab
    - Add: User picker for assigning approvers

### P2 -- Important Gaps

11. **Add Vertical Pack management screen** (S2.1)
    - New screen: Pack marketplace, enabled packs, version pinning
    - Sidebar: Add "Packs" navigation item under Configuration

12. **Add Run cancel action** (S4.1)
    - Location: Run detail actions
    - Add: Cancel button with confirmation, "Cancelled" status display

13. **Add quota visibility** (S2.2)
    - Location: Capability Matrix grid, Run detail
    - Add: Rate limit, daily cap columns in capability matrix
    - Add: Quota usage indicators when run is throttled/deferred

14. **Add retention class management** (S2.3)
    - Location: Settings (new section) or Evidence screen
    - Add: Retention class configuration (Operational/Compliance/Forensic)
    - Add: Legal hold management UI

15. **Add IncompatibleDuties policy support** (S5.11)
    - Location: Settings > Policies
    - Add: UI to create/view IncompatibleDuties constraints

16. **Surface adapter enable/disable** (S5.6)
    - Location: Settings > Adapters/Providers
    - Add: Toggle per adapter registration

17. **Add evidence payload viewer** (S5.10)
    - Location: Evidence screen, evidence entries
    - Add: Download/view links for payload refs

### P3 -- Nice to Have

18. **Add correlation ID display** (S2.7)
    - Location: Run detail, evidence entries
    - Add: CorrelationId as a copyable field

19. **Add domain event stream viewer** (S2.4)
    - New screen or drawer: Live event feed with filtering

20. **Add canonical object detail views** (S5.13)
    - Location: Evidence > Linked Objects
    - Add: Click-through to full canonical object detail

21. **Clarify Agents vs Machines terminology** (S3)
    - Align "Agents" screen with spec's Machine Registration concept
    - Or explicitly document that Agents are a separate UI-level concept

22. **Add observability dashboard hooks** (S2.5)
    - Location: New screen or external link
    - Add: Trace viewer, metrics dashboard, OTLP export config

23. **Add bulk operations** (S5.14)
    - Location: All list screens
    - Add: Multi-select, bulk approve, bulk retry, bulk close

---

## Appendix: Screens Audited

| Screen             | Spec Alignment Summary                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inbox              | Good coverage; persona-based filtering aligns with RBAC                                                                                                           |
| Project Overview   | Metrics present; missing quota and retention data                                                                                                                 |
| Work Items (list)  | Status values violate spec; missing SLA column; missing pagination                                                                                                |
| Work Item (detail) | Strong: linked records, tabs, effects. Missing SLA, derived vs real status                                                                                        |
| Runs (list)        | Missing Cancelled state, pagination; "Paused" label mismatch                                                                                                      |
| Run (detail)       | Strong: plan/effects, approval gate, evidence. Missing correlation ID, WaitingForApproval label                                                                   |
| Approvals          | Good: table + triage. Missing SLA timer, assignee column, pagination                                                                                              |
| Evidence           | Good: chain integrity, retention tags, linked objects. Missing retention class, legal hold, payload viewer                                                        |
| Workflow Builder   | Good: visual builder, node types, config. Missing version, active toggle, "Execution Tier" naming                                                                 |
| Agents             | Not in any spec -- entirely UI-originated concept. Needs alignment with Machine Registration or explicit new spec                                                 |
| Settings           | Good coverage of RBAC, credentials, adapters, policies. Missing: credential revoke, adapter enable/disable, retention config, IncompatibleDuties, pack management |
