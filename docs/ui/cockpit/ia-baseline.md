# Cockpit IA Baseline: Work-Item Hub, Approvals, Evidence, Correlation

> **Audience**: Frontend engineers, UX designers, and product owners.
>
> **Goal**: Define the information architecture (IA) baseline for the Cockpit MVP — the
> minimum set of views, navigation structure, and data relationships needed to demonstrate
> a governed workflow end-to-end.

---

## 1. Navigation structure

```
Cockpit
├── / (Dashboard)
│     Quick stats: pending approvals, active runs, recent evidence
│
├── /work-items                     Work-Item Hub
│     ├── /work-items/:id           Work-Item Detail
│     └── /work-items/new           Create Work Item
│
├── /approvals                      Approvals Hub
│     ├── /approvals/pending        Pending Approvals
│     └── /approvals/:id            Approval Detail
│
├── /runs                           Run Hub
│     ├── /runs/:id                 Run Detail
│     └── /runs/:id/evidence        Evidence View (inline)
│
├── /evidence                       Evidence Explorer
│     └── /evidence/:chainId        Chain Viewer
│
└── /settings                       Settings
      ├── /settings/workspace       Workspace
      └── /settings/integrations    Integration registry
```

---

## 2. View inventory

### 2.1 Dashboard (`/`)

**Purpose**: At-a-glance operational status.

**Data shown**:

- Count: pending approvals requiring my action (badge)
- Count: active runs (in-progress)
- Count: failed runs (last 24 h)
- Recent activity feed (last 10 events: work-item created, run started, approval granted)

**Primary actions**:

- "Review pending approvals" → `/approvals/pending`
- "Start new work item" → `/work-items/new`

---

### 2.2 Work-Item Hub (`/work-items`)

**Purpose**: Canonical list of all work items in the workspace.

**Data shown** (table/list):
| Column | Source |
|--------|--------|
| ID | `WorkItemId` |
| Title | `WorkItem.title` |
| Status | `WorkItem.status` (draft / active / paused / closed) |
| Assignee | `WorkItem.assignedTo` |
| Last run | Linked `Run.startedAt` |
| Created | `WorkItem.createdAt` |

**Filters**: status, assignee, date range
**Primary action**: "New work item"

---

### 2.3 Work-Item Detail (`/work-items/:id`)

**Purpose**: Full view of a single work item and its execution history.

**Sections**:

1. **Header**: title, status badge, assignee, tags
2. **Description**: rich-text or markdown body
3. **Workflow spec**: read-only YAML/JSON renderer of the attached workflow definition
4. **Runs tab**: list of runs (start time, status, duration, link to run detail)
5. **Approvals tab**: list of approval checkpoints (name, tier, status, approver)
6. **Evidence tab**: summary of evidence entries linked to this work item

**Primary actions**: "Start run", "Edit", "Archive"

---

### 2.4 Approvals Hub (`/approvals/pending`)

**Purpose**: My approval queue — items requiring action.

**Data shown**:
| Column | Source |
|--------|--------|
| Checkpoint name | `ApprovalRequest.checkpointName` |
| Work item | Link to `WorkItem.title` |
| Run | Link to `Run.id` |
| Policy tier | `ApprovalRequest.tier` (Assisted / HumanApprove / ManualOnly) |
| Requested at | `ApprovalRequest.requestedAt` |
| Time waiting | Computed |

**Primary action**: "Approve" / "Reject" inline

---

### 2.5 Approval Detail (`/approvals/:id`)

**Purpose**: Full context for a single approval decision.

**Sections**:

1. **Request context**: checkpoint name, policy tier, run state at decision point
2. **Evidence summary**: last N evidence entries before this checkpoint
3. **AI summary** (Assisted tier): LLM-generated rationale for the proposed action
4. **Decision form**: Approve / Reject / Request change + mandatory comment field
5. **Audit trail**: previous decisions on this checkpoint (re-runs)

---

### 2.6 Run Hub (`/runs`)

**Purpose**: List of all workflow runs (filterable by work item, status, date).

**Data shown**:
| Column | Source |
|--------|--------|
| Run ID | `Run.id` |
| Work item | Link |
| Status | `Run.status` (pending / running / paused / succeeded / failed / cancelled) |
| Started | `Run.startedAt` |
| Duration | Computed |
| Evidence entries | Count |

---

### 2.7 Run Detail (`/runs/:id`)

**Purpose**: Full timeline and evidence chain for a single run.

**Sections**:

1. **Run header**: status, duration, triggeredBy
2. **Step timeline**: ordered list of steps with status icons and timestamps
3. **Evidence feed**: real-time-updating list of `EvidenceEntryV1` records
4. **Active approval** (if paused): inline approval form (same as Approval Detail)
5. **Logs** (collapsible): raw stdout/stderr from each step

---

### 2.8 Evidence Explorer (`/evidence`)

**Purpose**: Cross-run evidence search and chain verification.

**Features**:

- Search by: run ID, work item, date range, event kind
- Chain viewer: visualize hash-chain linkage, highlight broken links
- Export: download chain as JSON for external verification

**Chain viewer states**:

- 🟢 Verified — all hashes match, timestamps monotonic
- 🔴 Tampered — hash mismatch at index N
- ⚠️ Incomplete — missing entries (gaps in sequence)

---

## 3. Data relationships

```
Workspace
  └── WorkItem (1:N)
        ├── WorkflowDefinition (1:1)
        └── Run (1:N)
              ├── ApprovalRequest (0:N)
              └── EvidenceEntry (1:N)  ← hash-chained
```

**Correlation key**: `correlationId` links a Run to its EvidenceEntries and ApprovalRequests
across all views. The Cockpit must propagate `correlationId` in all API calls to enable
end-to-end tracing.

---

## 4. Component inventory (MVP)

| Component               | Used in                       | Notes                             |
| ----------------------- | ----------------------------- | --------------------------------- |
| `StatusBadge`           | All hubs                      | work-item / run / approval status |
| `EvidenceChainViewer`   | Run Detail, Evidence Explorer | Uses `evidence-chain-verifier.ts` |
| `ApprovalForm`          | Approval Detail, Run Detail   | Approve/Reject + comment          |
| `StepTimeline`          | Run Detail                    | Ordered step list with icons      |
| `WorkItemTable`         | Work-Item Hub                 | Sortable/filterable table         |
| `RunTable`              | Run Hub, Work-Item Detail     | Same pattern                      |
| `ApprovalQueue`         | Dashboard, Approvals Hub      | Pending approval list             |
| `AIRationaleSummary`    | Approval Detail               | Assisted-tier LLM summary         |
| `CorrelationBreadcrumb` | Run Detail, Evidence          | Work item → Run → Evidence trail  |

---

## 5. API surface required (control-plane)

| View             | Endpoint                                                     | Method |
| ---------------- | ------------------------------------------------------------ | ------ |
| Work-Item Hub    | `GET /workspaces/:wsId/work-items`                           | List   |
| Work-Item Detail | `GET /workspaces/:wsId/work-items/:id`                       | Read   |
| Run Hub          | `GET /workspaces/:wsId/runs`                                 | List   |
| Run Detail       | `GET /workspaces/:wsId/runs/:id`                             | Read   |
| Evidence feed    | `GET /workspaces/:wsId/runs/:id/evidence`                    | List   |
| Approval queue   | `GET /workspaces/:wsId/approvals?status=pending&assignee=me` | List   |
| Approve          | `POST /workspaces/:wsId/approvals/:id/decide`                | Write  |

See `bead-0752` for contract alignment work.

---

## 6. MVP completion criteria

- [ ] All 8 views implemented with real API data (no mocks in production build)
- [ ] `EvidenceChainViewer` renders verified/tampered/incomplete states
- [ ] `ApprovalForm` submits decision and updates approval status in real-time
- [ ] `CorrelationBreadcrumb` navigates Work Item → Run → Evidence
- [ ] Responsive layout works on 375 px (mobile) and 1280 px (desktop)
- [ ] Accessibility: all interactive elements keyboard-navigable, ARIA labels present
- [ ] Lighthouse score ≥ 90 on Performance + Accessibility for dashboard view

---

## 7. Related documents

| Document                                    | Purpose                        |
| ------------------------------------------- | ------------------------------ |
| `docs/ui/cockpit/`                          | Existing Cockpit design docs   |
| `docs/onboarding/dev-track.md`              | Developer onboarding           |
| `docs/tutorials/hello-governed-workflow.md` | End-to-end workflow tutorial   |
| `src/sdk/evidence-chain-verifier.ts`        | Client-side chain verification |
| `src/sdk/mis-v1.ts`                         | Adapter interface              |
