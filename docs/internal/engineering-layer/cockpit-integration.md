# Cockpit Integration

How the engineering layer slots into the existing cockpit without duplicating what's already built.

---

## New routes

All under `apps/cockpit/src/routes/engineering/`. TanStack Router file-based convention.

```
routes/engineering/
  index.tsx                         → /engineering             (redirect → /engineering/beads)
  beads/
    index.tsx                       → /engineering/beads       (three-panel shell)
    $beadId/
      index.tsx                     → /engineering/beads/$beadId
      approval.tsx                  → /engineering/beads/$beadId/approval
      artifact.tsx                  → /engineering/beads/$beadId/artifact
  autonomy.tsx                      → /engineering/autonomy
  mission-control.tsx               → /engineering/mission-control
```

Add to `__root.tsx` sidebar:

```tsx
{ label: 'Beads',           to: '/engineering/beads',           icon: <GitBranch /> },
{ label: 'Mission Control', to: '/engineering/mission-control', icon: <LayoutDashboard /> },
{ label: 'Autonomy',        to: '/engineering/autonomy',        icon: <Sliders /> },
```

---

## Component reuse — what already exists

| Existing component | How it's used |
|---|---|
| `ApprovalReviewPanel` | Decision bar inside `DiffApprovalSurface` |
| `ApprovalGatePanel` | Inline gate state in `BeadThreadPanel` |
| `EvidenceTimeline` | Reuse directly in bead detail Evidence tab |
| `ChainIntegrityBanner` | Top of evidence view + topbar status |
| `RunStatusBadge` | Bead status in list rows and kanban cards |
| `SodBanner` | Approval surface SoD eligibility display |
| `StepList` | Step sequence inside bead thread |
| `ResizablePanelGroup` | Three-panel shell layout |
| `Progress` | Scroll progress bar in diff surface |
| `NotificationBanner` | Approval count alert from notification link |
| `OfflineSyncBanner` | Outbox pending count during connectivity loss |

---

## New components

### `BeadThreadPanel`
**File:** `components/cockpit/bead-thread-panel.tsx`

Live tool call feed. SSE-driven via `use-bead-thread-stream.ts`.

```ts
interface ToolCallEntry {
  id: string; toolName: string; args: Record<string, unknown>
  status: 'pending' | 'running' | 'success' | 'error' | 'awaiting_approval'
  policyTier: PolicyTier; blastRadius: BlastLevel
  approvalId?: string
}
```

SSE pattern: extend `use-approval-event-stream.ts` → `GET /v1/workspaces/:wsId/beads/:beadId/events`

shadcn: `Card`, `Collapsible`, `ScrollArea`, `Badge`, `Skeleton`

---

### `DiffApprovalSurface`
**File:** `components/cockpit/diff-approval-surface.tsx`

```ts
interface DiffApprovalSurfaceProps {
  beadId: string; approvalId: string
  policyTier: PolicyTier; policyRationale: string
  blastRadius: BlastLevel; isIrreversible: boolean
  hunks: DiffHunk[]
  recentEvidence: EvidenceEntryV1[]
  onDecide: (decision: 'Approved' | 'Denied' | 'RequestChanges', rationale: string) => Promise<void>
}
```

Scroll gate: `IntersectionObserver` on sentinel at bottom of last hunk. `disabled={!hasReadAll || rationale.length < 10}`. Resets if `hunks` changes.

shadcn: `ScrollArea`, `Progress`, `Textarea`, `Button`, `Badge`, `Separator`

Full-page route — not a Sheet. Bookmarkable and shareable.

---

### `BeadKanbanBoard`
**File:** `components/cockpit/bead-kanban-board.tsx`

Four columns: Ready | Running | Awaiting Approval | Done.
Awaiting Approval column: amber background, pulsing border on cards waiting >15min.

shadcn: `Card`, `Badge`, `ScrollArea`

---

### `AutonomyDialControl`
**File:** `components/cockpit/autonomy-dial-control.tsx`

Per-action-class tier matrix. 4-stop segmented control per row.
Colors: `auto`(green) → `assisted`(blue) → `human-approve`(amber) → `blocked`(red).
Simulate button per row: N recent runs affected by tier change.

shadcn: `Switch`, button group, `Skeleton`, `Separator`

---

### `PolicyTierBadge`
**File:** `components/cockpit/policy-tier-badge.tsx`

| Tier | className |
|---|---|
| AUTO | `bg-green-100 text-green-800 border-green-300` |
| ASSISTED | `bg-blue-100 text-blue-800 border-blue-300` |
| HUMAN-APPROVE | `bg-amber-100 text-amber-800 border-amber-300` |
| BLOCKED | destructive variant |

---

### `BlastRadiusBadge`
**File:** `components/cockpit/blast-radius-badge.tsx`

| Level | className |
|---|---|
| low | `bg-gray-100 text-gray-600` |
| medium | `bg-yellow-100 text-yellow-800` |
| high | `bg-orange-100 text-orange-800` |
| critical | `bg-red-100 text-red-800` |

---

### `RunArtifactViewer`
**File:** `components/cockpit/run-artifact-viewer.tsx`

Renders `ArtifactV1` as markdown. Inline diffs, embedded media (`<video>`/`<img>`), annotation mode, export buttons.

---

### `MissionControlHeader`
**File:** `components/cockpit/mission-control-header.tsx`

```ts
interface MissionControlHeaderProps {
  awaitingCount: number; runningCount: number
  chainVerified: boolean; lastChainCheckAt: string
}
```

---

## Data flow

```
SSE stream → useBeadThreadStream → BeadThreadPanel
TanStack Query GET /beads → BeadNavList + BeadKanbanBoard
TanStack Query GET /approvals/:id → DiffApprovalSurface
TanStack Mutation POST /approvals/:id/decide → invalidates queries → Temporal signal
TanStack Query GET /autonomy-policy → AutonomyDialControl
TanStack Mutation PATCH /autonomy-policy → optimistic update
```

---

## Existing routes (don't duplicate)

| Existing route | Engineering layer use |
|---|---|
| `/approvals` | Cross-link from bead thread for full triage queue |
| `/evidence` | Cross-link from bead detail Evidence tab |
| `/runs` | Cross-link from bead detail |
| `/config/policies` | Autonomy dial is a simplified view over same data |
