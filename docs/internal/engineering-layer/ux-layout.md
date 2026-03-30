# Engineering Cockpit — UX Layout

## Base: T3 Code's three-panel shell

T3 Code's layout is the right foundation. It was designed for exactly this — one task per git worktree, parallel tasks visible simultaneously, the diff as the primary review surface. Portarium already uses git worktrees per bead. The layout maps directly.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TOPBAR: workspace · global search · [3 pending] approval badge · bell  │
├──────────────┬──────────────────────────────┬───────────────────────────┤
│  LEFT PANEL  │  CENTER PANEL                │  RIGHT PANEL              │
│  (240px)     │  (fluid)                     │  (420px)                  │
│              │                              │                           │
│  Bead list   │  Active bead kanban          │  Selected bead detail:    │
│  filtered    │  or bead thread (live)       │  • tool call feed         │
│  by status   │                              │  • diff                   │
│              │                              │  • approval gate          │
│              │                              │  • evidence entries       │
├──────────────┴──────────────────────────────┴───────────────────────────┤
│  STATUS BAR: 7 running · 3 awaiting approval · chain verified           │
└─────────────────────────────────────────────────────────────────────────┘
```

### T3 Code → Portarium mapping

| T3 Code                         | Portarium                                                   |
| ------------------------------- | ----------------------------------------------------------- |
| Projects list (left)            | Bead list — filterable by status / policy tier / actor      |
| Thread list (center)            | Bead kanban: Ready → Running → **Awaiting Approval** → Done |
| Chat + diff + terminal (right)  | Bead thread: tool call feed + diff + approval gate          |
| "New thread"                    | "New bead" / trigger workflow (command palette `Ctrl+K`)    |
| Commit → push → PR (one action) | Approve → evidence signed → bead merges (one action)        |
| One worktree per thread         | One worktree per bead (already how Portarium works)         |

The key adaptation: T3 Code's right panel shows a diff and a commit button. Portarium's right panel shows the same diff but routes approval through the policy engine. Same surface, different consequence.

---

## What Mission Control adds on top

Mission Control's 32-panel concept fails (cognitive overload, no visual hierarchy). What works:

| Mission Control concept          | Where it goes in Portarium                                      |
| -------------------------------- | --------------------------------------------------------------- |
| Kanban REVIEW column             | The center panel kanban gets an **Awaiting Approval** column    |
| Operational overview             | Sticky topbar KPI strip (not a separate page)                   |
| Skills Hub / capability registry | `/engineering/autonomy` route — separate from the 3-panel shell |
| Per-item status color            | `PolicyTierBadge` + `BlastRadiusBadge` on every bead card       |

---

## Vocabulary: no "trust score"

Portarium doesn't score trust. It evaluates policy. The two badges that replace a trust score:

### `PolicyTierBadge`

| Tier            | Badge color | Meaning                                                  |
| --------------- | ----------- | -------------------------------------------------------- |
| `AUTO`          | Green       | Engine approved — no human needed                        |
| `ASSISTED`      | Blue        | Executed, cockpit notified — human can review after      |
| `HUMAN-APPROVE` | Amber       | **Blocked** — human must decide before anything executes |
| `BLOCKED`       | Red         | Policy denies this action class entirely                 |

### `BlastRadiusBadge`

From the existing `openclaw-tool-blast-radius-v1.ts` classifier.

| Level      | Badge  | Meaning                                         |
| ---------- | ------ | ----------------------------------------------- |
| `low`      | Grey   | Read-only, isolated, fully reversible           |
| `medium`   | Yellow | Writes to a single system, reversible           |
| `high`     | Orange | Writes to multiple systems or hard to reverse   |
| `critical` | Red    | Irreversible, wide-blast, or touches money/auth |

---

## Left panel: Bead list

```
┌─ BEADS ──────────────────────────────────┐
│  [All] [Running] [Awaiting] [Done]        │
│  ──────────────────────────────────────  │
│  bead-0936                               │
│  Refactor telemetry boundary             │
│  [HUMAN-APPROVE] [high] · 8m waiting     │
│  ──────────────────────────────────────  │
│  bead-0937                               │
│  Add payments webhook                    │
│  [AUTO] [low] · running 2m              │
└──────────────────────────────────────────┘
```

---

## Center panel: Kanban

```
  READY          RUNNING         AWAITING APPROVAL    DONE
  ─────          ───────         ─────────────────    ────
  bead-0940      bead-0937       bead-0936            bead-0933
  [AUTO][low]    [AUTO][low]     [HUMAN-APPROVE]      [AUTO]
                                 [critical]           merged 1h ago
                 bead-0938       8m waiting
                 [ASSISTED]
                 [medium]
```

The **Awaiting Approval** column is the Mission Control REVIEW column. Amber background, pulsing border on cards waiting >15 minutes.

---

## Right panel: Bead thread

```
┌─ bead-0936: Refactor telemetry boundary ──────────────────────────┐
│  [HUMAN-APPROVE] [high] · agent:openclaw · triggered by ops-team  │
│  ─────────────────────────────────────────────────────────────────│
│  09:12:01  read_file    boundary.ts                 [OK]  [low]   │
│  09:12:04  edit_file    boundary.ts                 [OK]  [med]   │
│  09:12:09  run_tests    npm run test:watch           [OK]  [low]   │
│  ─── APPROVAL GATE ────────────────────────────────────────────── │
│  │ git_push  origin main                    [HUMAN-APPROVE][crit] │
│  │ Policy: INFRA-WRITE-002                                  │     │
│  │ Waiting 8 minutes                            [Review →]  │     │
│  ──────────────────────────────────────────────────────────────── │
│  DIFF (collapsed — auto-expands when gate hit)                    │
│  src/domain/telemetry/boundary.ts  +12 -3  [Expand]              │
└───────────────────────────────────────────────────────────────────┘
```

- The approval gate is a **first-class UI state**, not a loading spinner.
- Diff is collapsed during monitoring. Auto-expands when a gate is reached.

---

## The approval surface

Full-width inside right panel, or full-page route for deep-link:

```
┌─ APPROVAL GATE ───────────────────────────────────────────────────┐
│  bead-0936 · Policy: INFRA-WRITE-002 · Requested 8 minutes ago    │
│  [SoD] You are eligible · Requestor: agent:openclaw ≠ you        │
│  [Blast radius] main branch · 3 services · Irreversible: YES      │
│                                                                   │
│  [Full unified diff]                                              │
│  [scroll progress ████████░░ 80%]                                 │
│                                                                   │
│  Last 3 evidence entries: tests passed · lint clean · build OK    │
│  Rationale (required, min 10 chars): [                       ]    │
│  [Approve — scroll to unlock]    [Deny]    [Request changes]      │
└───────────────────────────────────────────────────────────────────┘
```

Anti-rubber-stamp mechanics:

1. Scroll gate — IntersectionObserver on sentinel at diff bottom
2. Rationale required — min 10 chars
3. SoD banner — if you triggered the run, Approve is disabled
4. Time shown factually — no manufactured urgency

---

## Autonomy configuration (`/engineering/autonomy`)

```
WORKSPACE AUTONOMY: acme-corp

Action class              Tier               Simulate impact
─────────────────────────────────────────────────────────────
read:any                  [AUTO      ●]      [Simulate]
write:crm                 [AUTO      ●]      [Simulate]
write:finance             [HUMAN-APPROVE ●]  [Simulate]
write:infrastructure      [HUMAN-APPROVE ●]  [Simulate]
send:external             [ASSISTED  ●]      [Simulate]
delete:any                [HUMAN-APPROVE ●]  [Simulate]
deploy:production         [HUMAN-APPROVE ●]  [Simulate]
```

Simulate per row: shows how many recent runs would have been affected. No sliders. No scores. Discrete four-state tier.

---

## Topbar: ambient operational awareness

```
[portarium]  workspace: acme-corp ▼   [search]   [3 awaiting ⚠]  [7 running ●]  [chain ✓]  [bell]
```

- **3 awaiting** — amber badge, primary interrupt
- **7 running** — green, informational
- **chain ✓** — WORM integrity. Red triggers full banner.

---

## Evidence inspector

Three modes from bead detail Evidence tab:

| Mode                   | Purpose                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Timeline** (default) | Chronological feed. Each entry: sequence number, event in plain language, actor, relative time, 8-char hash chip. |
| **Chain verifier**     | Hash-chain as node graph. Broken links render red. Export: verification report, evidence bundle, legal hold.      |
| **Search**             | Filter by run ID, actor, event kind, date range, bead ID. For incident reconstruction.                            |

Full SHA-256 hashes truncated to 8 chars on primary surfaces — full hash in tooltip.
