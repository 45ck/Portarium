# Build Plan

Ordered by dependency. Each phase must be complete before the next starts. Phases 2-5 (cockpit UI) can be built in parallel with Phase 6 (backend) via MSW mocks.

---

## Phase 0 — Fix governance theater (prerequisite, not optional)

**bead-0972** — Fail-closed noop stubs

- `ControlPlaneDeps` optional fields must throw at startup or return 503
- Remove inline noop stubs in `control-plane-handler.agent-actions.ts` lines 126-150
- Add `GovernanceBypassed` evidence entry when `actionRunner` absent

**bead-0973** — workspaceId session-binding + fail-closed hooks

- `expectedWorkspaceId` check in `jose-jwt-authentication.ts:381` non-optional for mutation-tier ops
- `before_tool_call` hook crash = block tool call (not allow)
- Auth startup hard-fail on missing secrets

---

## Phase 1 — portarium plugin hooks (already planned, P0)

**bead-0958** — Scaffold package structure (claimed by worker-terraform)
**bead-0959** — `before_tool_call` governance hook — must actually register the hook
**bead-0960** — Approval poller: `approvalTimeoutMs: Infinity`, `pollIntervalMs: 5000`
**bead-0961** — Explicit agent tools: `portarium_get_run`, `portarium_list_approvals`, `portarium_capability_lookup`

---

## Phase 2 — Cockpit engineering shell

**bead-0974** — Engineering cockpit shell (T3 three-panel layout)

- `routes/engineering/beads/index.tsx`
- `ResizablePanelGroup`: `BeadNavList` / `BeadKanbanBoard` / `<Outlet />`
- `BeadKanbanBoard` columns: Ready / Running / Awaiting Approval / Done
- `MissionControlHeader` topbar
- `PolicyTierBadge` + `BlastRadiusBadge` components

---

## Phase 3 — Bead thread panel + SSE stream

**bead-0975** — BeadThreadPanel + bead events SSE endpoint

- `GET /v1/workspaces/:wsId/beads/:beadId/events` SSE
- `use-bead-thread-stream.ts` — extends `use-approval-event-stream.ts` pattern
- `BeadThreadPanel`: live tool call feed, inline `ApprovalGatePanel` when awaiting
- Re-hydrates on reconnect via `GET /v1/beads/:beadId/thread`

---

## Phase 4 — Diff approval surface + Run Artifact

**bead-0976** — DiffApprovalSurface + diff endpoint

- `GET /v1/workspaces/:wsId/beads/:beadId/diff` → `DiffHunk[]`
- `DiffApprovalSurface`: scroll gate, rationale min 10 chars, SoD banner
- Full-page bookmarkable route
- Reuses `ApprovalReviewPanel` decision bar

**bead-0977** — Run Artifact (markdown)

- `ArtifactCollector` produces structured markdown: goal, steps, diff summary, gates, verification
- `ArtifactV1` stored in evidence chain
- `RunArtifactViewer` component + `/engineering/beads/:id/artifact` route

---

## Phase 5 — Autonomy dial + HCI operator model

**bead-0978** — AutonomyDialControl + autonomy-policy API

- `GET/PATCH /v1/workspaces/:wsId/autonomy-policy` + simulate endpoint
- `AutonomyDialControl`: per-action-class rows, 4-stop tier selector, Simulate button

**bead-0979** — Autonomy confidence digest + operator state machine

- Weekly digest artifact: AUTO/ASSISTED/HUMAN-APPROVE counts, anomaly rate, reversal rate
- Operator acknowledgment flow
- Policy calibration shortcut from digest (one-click promote/demote)
- Cockpit operator state transitions (CALM/INFORMED/ATTENTIVE/ALERT/ACTIVE/RESOLVED)

---

## Phase 6 — Pipeline backend

**bead-0980** — WorktreePort + BeadLifecycleWorkflow (Temporal)

- `WorktreePort` interface + contract test
- Extends `workflows.ts`: worktreeStart / agentExecution (heartbeat 60s) / artifactCollect / waitForApprovalSignal / merge
- `bd issue finish` conditional on CI outcome — worktree preserved on failure

**bead-0981** — BeadPlanner + domain types

- `decomposeToPlan(intent) → PlanV1`, `planToBeads(plan) → BeadProposal[]`
- `maxBeadsPerIntent: 20`, requires human confirmation, each bead needs spec reference
- New domain types: `ProjectIntent`, `BeadProposal/v1`, `WorktreeHandle`, `AutonomyPolicy`

---

## Phase 7 — Intent trigger (full loop)

**bead-0969** — IntentRouter + cockpit trigger surface

- `IntentRouter` use-case: normalise trigger → `ProjectIntent` → `BeadPlanner`
- Command palette `Ctrl+K` natural language entry
- Plan Artifact shown for human confirmation before worktrees created

---

## Artifact phases (P2, parallel)

**bead-0970** — Demo Artifact (demo-machine + gif/mp4)

- Extend demo-machine clips to produce Run Artifacts with embedded screenshots
- `ArtifactV1.mediaRefs` with sha256 per media file
- `RunArtifactViewer` renders video/gif inline

**bead-0971** — Weekly Autonomy Digest artifact

- Aggregated AUTO/ASSISTED/HUMAN-APPROVE counts, anomaly + reversal rates
- Recommended policy adjustments from 90-day history
- Operator acknowledgment recorded in WORM chain

---

## Security gates (entry criteria for phases 1 and 6)

| Gate                                    | Bead      | Must be done before |
| --------------------------------------- | --------- | ------------------- |
| LLM output sanitization at MCP boundary | bead-0973 | Phase 1 ships       |
| workspaceId session-bound               | bead-0973 | Phase 1 ships       |
| Fail-closed hooks                       | bead-0973 | Phase 1 ships       |
| Dependency manifest scan at PR gate     | bead-0976 | Phase 4 ships       |
