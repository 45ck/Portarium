# Artifacts: Making Agent Work Reviewable

## The concept

Google Antigravity introduced structured **Artifacts** — not logs, not diffs, but annotatable deliverables that agents produce as tangible evidence of their work. "Regulators don't care that an AI wrote code. They care that you can explain every decision."

Portarium already has a WORM evidence chain. What it needs is the **human-facing layer on top** — structured artifacts that make agent work reviewable at the right level of abstraction.

An artifact is not a log. It is a **narrative document** that a human can read, annotate, and sign off on.

---

## Artifact types (in order of implementation priority)

### 1. Run Artifact (Markdown, P0)

Produced at the end of every bead run.

```markdown
# Run Artifact: bead-0936

**Goal:** Refactor telemetry boundary to remove infrastructure dependency
**Agent:** agent:openclaw **Duration:** 4m 31s
**Policy tier:** HUMAN-APPROVE (highest tier reached) **Blast radius:** high

## What was done

1. Read `src/domain/telemetry/boundary.ts` — identified 3 infrastructure imports
2. Edited `src/domain/telemetry/boundary.ts` — removed PrismaClient import, replaced with port
3. Added `src/domain/telemetry/telemetry-port.ts` — new port interface
4. Ran tests: 427 passed, 0 failed

## What changed

3 files modified, 1 file added

## Policy gates hit

| Action               | Tier          | Decision | Decided by     |
| -------------------- | ------------- | -------- | -------------- |
| git_push origin main | HUMAN-APPROVE | Approved | alice@acme.com |

## Verification

- Tests: 427 passed ✓ Lint: 0 errors ✓ Typecheck: clean ✓

## Evidence chain

First entry: #141 · Last entry: #156 · Chain: verified ✓
```

Stored as `ArtifactV1` in evidence chain. Rendered at `/engineering/beads/:id/artifact`.

---

### 2. Plan Artifact (Markdown, P0)

Produced by `BeadPlanner` before any worktrees are created. The human confirmation step.

```markdown
# Plan: "Add webhook endpoint for payments"

Decomposed into 4 beads by BeadPlanner

## Beads

1. bead-0969 Add PaymentWebhookController [ASSISTED]
2. bead-0970 Add PaymentEventProcessor [ASSISTED]
3. bead-0971 Add webhook signature verification middleware [HUMAN-APPROVE]
4. bead-0972 Add integration test [AUTO]

## Dependencies

0969 → 0970 → 0971 → 0972

[Approve this plan →] [Modify →] [Cancel →]
```

Humans approve the plan before any worktree is created.

---

### 3. Approval Artifact (Markdown, P0)

The permanent record of a human approval decision, appended to the WORM chain.

```markdown
# Approval Record: APR-0291

**Action:** git_push origin main
**Policy:** INFRA-WRITE-002 [HUMAN-APPROVE]
**Decision:** Approved by alice@acme.com

**Rationale:** "Reviewed diff — telemetry port abstraction is clean, tests pass."

**Chain:** Hash: a3f8d2c1 · Verified: ✓
```

---

### 4. Demo Artifact (Markdown + embedded gif/mp4, P1)

Extends the demo-machine clip system. Every run artifact can optionally include a recorded walkthrough.

```markdown
# Demo: Approval gate unblocks run

![Approval flow](./clips/approval-gate-demo.gif)

Shows: agent runs AUTO actions → git_push hits HUMAN-APPROVE gate → operator
reviews diff, types rationale, approves → agent unblocks → WORM receipt appears.
```

**Connection to demo-machine:** The existing `docs/internal/ui/cockpit/demo-machine/` clip system produces yaml-driven demo scripts. The artifact system consumes those outputs (screenshots, recordings) and embeds them into run artifacts as evidence of behavior.

---

### 5. Digest Artifact (Markdown, P1)

Weekly summary of all AUTO activity — the autonomy confidence loop surface.

```markdown
# Weekly Autonomy Digest: 2026-03-24 → 2026-03-31

| Tier          | Actions | Anomalies | Reversals |
| ------------- | ------- | --------- | --------- |
| AUTO          | 247     | 0         | 0         |
| ASSISTED      | 31      | 2         | 0         |
| HUMAN-APPROVE | 18      | —         | 1         |

## Recommended policy adjustments

- `write:lint-fix` has 34 AUTO decisions, 0 anomalies over 90 days
  → Consider promoting `write:refactor-small` to AUTO

[Acknowledge digest →] [Adjust policy →]
```

---

## Implementation in cockpit

### `RunArtifactViewer` component

**File:** `apps/cockpit/src/components/cockpit/run-artifact-viewer.tsx`

- Renders markdown with syntax highlighting
- Diff blocks rendered inline using `DiffApprovalSurface` diff renderer
- Embedded media: `<video>` for mp4, `<img>` for gif
- Annotation mode: operator highlights section + adds comment (Antigravity-style)
- Export: "Download as PDF" / "Export as evidence bundle"

### Artifact route

`apps/cockpit/src/routes/engineering/beads/$beadId/artifact.tsx`

Standalone page, shareable URL. Cross-links: approval decision → artifact → WORM chain entries.

---

## Connection to demo-machine and content-machine

Extension plan:

1. **Demo clips produce Run Artifacts** — each clip execution generates a markdown run artifact with embedded screenshots
2. **content-machine produces Demo Artifacts** — recorded mp4/gif of the approval flow, embedded in artifact viewer
3. **Marketing artifacts** — demo artifacts are designed to be shareable externally (redacted of sensitive data)

**Markdown artifacts first** — get the structured text layer right before adding media.

---

## Artifact storage

Artifacts are `ArtifactV1` records stored in the evidence chain — hash-signed and tamper-evident.

`ArtifactV1.mediaRefs: Array<{ type: 'gif' | 'mp4' | 'png', url: string, sha256: string }>`

The sha256 on each media ref ensures embedded media is as tamper-evident as the artifact text.
