# Cockpit Platform Showcase Readiness Plan

## Purpose

Make Cockpit useful in demo/mock mode without relying on a vertical prototype.
The default demo dataset must show real Cockpit data surfaces backed by safe,
generic Portarium snapshot data.

## Current Posture

- Default dataset: `platform-showcase`
- Workspace: `ws-platform-showcase`
- Data source: in-memory mock handlers and hand-authored snapshot fixtures
- Mutation posture: browser-local mock state only; no real-world writes
- Boundary posture: no organization-specific references in Portarium
- Prototype posture: legacy vertical demos have been removed from the Cockpit
  dataset registry and active route graph
- Production build posture: Cockpit emits the generic `platform-showcase` mock
  asset only
- Robotics posture: robotics demo surfaces require a dedicated robotics demo flag

## What The Dataset Covers

The default dataset should keep these Cockpit surfaces meaningful:

- Dashboard and overview metrics
- Work items and work item detail
- Runs and run detail
- Approvals and triage
- Evidence and provenance
- Workforce members, queues, and human tasks
- Agents, machines, adapters, and credential grants
- Observability, events, governance, and explore surfaces

The fixture intentionally avoids vertical-specific examples such as schools,
customer-specific packs, robotics missions, or product-specific workflows.

## Safety Rules

- Portarium committed code must stay generic.
- Customer, school, or extension-specific content belongs in external extension
  packages, not in Portarium.
- Demo mode may simulate planned effects, but those effects must remain inside
  mock fixtures and mock handlers.
- No default route should expose vertical prototype data.
- Retired vertical dataset IDs must resolve back to `platform-showcase`.
- Production Cockpit builds must not emit retired vertical fixture chunks.

## Environment Flags

| Flag | Default | Purpose |
| --- | --- | --- |
| `VITE_DEMO_MODE` | dev-dependent | Enables Cockpit mock/demo runtime |
| `VITE_PORTARIUM_ENABLE_ROBOTICS_DEMO` | `false` | Shows robotics demo routes and triage mode |
| `VITE_PORTARIUM_SHOW_INTERNAL_COCKPIT` | `false` | Shows internal Engineering/Beads surfaces |
| `VITE_PORTARIUM_SHOW_ADVANCED_TRIAGE` | `false` | Shows advanced triage modes such as briefing, graph, replay, and timeline |

## Default Visible Route Inventory

| Route | Status | Notes |
| --- | --- | --- |
| `/inbox` | Data-backed | Aggregates approvals, runs, evidence, human tasks, workforce, and adapters |
| `/dashboard` | Data-backed | Uses runs, approvals, work items, adapters, evidence, and observability |
| `/projects` | Data-backed | Derived project portfolio from active workspace data |
| `/work-items` | Data-backed | Work item list/detail backed by active dataset/API |
| `/runs` | Data-backed | Run list/detail backed by active dataset/API |
| `/workflows` | Data-backed | Workflow definitions derived from active runs/agents |
| `/approvals` | Data-backed | Plain triage default; advanced triage modes are opt-in |
| `/evidence` | Data-backed | Evidence list backed by active dataset/API |
| `/search` | Data-backed | Retrieval/graph responses derive from active evidence/run records in mock mode |
| `/workforce` | Data-backed | Workforce members backed by active dataset/API |
| `/workforce/queues` | Data-backed | Queues backed by active dataset/API |
| `/workforce/coverage` | Honest empty by default | Starts empty unless the active dataset provides a coverage roster |
| `/config/machines` | Data-backed | Machine registry backed by active dataset/API |
| `/config/agents` | Data-backed | Agent registry backed by active dataset/API |
| `/config/adapters` | Data-backed | Adapter registry backed by active dataset/API |
| `/config/credentials` | Partially gated | Credential grant surfaces require demo controls |
| `/config/policies` | Generic fixture/API-backed | Generic platform policies, no vertical branding |
| `/config/users` | Generic fixture/API-backed | Generic platform users matching the showcase actors |
| `/config/settings` | Runtime/local settings | Dataset controls are visible only in demo mode |
| `/explore/objects` | Data-backed | Derived from active work item external refs |
| `/explore/events` | Data-backed | Evidence event stream backed by active evidence |
| `/explore/observability` | Data-backed | Observability model derived from active Cockpit records |
| `/explore/governance` | Data-backed | Policies/evidence/workflows backed by generic platform data |
| `/explore/extensions` | Platform/admin | Extension registry and activation context |

Hidden by default: `/engineering/*`, `/robotics/*`, `/workflows/builder`,
`/workflows/$workflowId/edit`, `/config/policies/studio`,
`/config/capability-posture`, `/config/blast-radius`, and `/explore/pack-runtime`.
These routes require
`VITE_PORTARIUM_SHOW_INTERNAL_COCKPIT=true` or the dedicated robotics flag where
applicable.

## Verification

Run the focused Cockpit checks:

```bash
npm run -w apps/cockpit test -- src/lib/cockpit-runtime.test.ts src/mocks/fixtures/platform-showcase.test.ts src/lib/shell/navigation.test.tsx src/routes/robotics/robotics-runtime-gating.test.tsx src/components/cockpit/command-palette.test.tsx
```

Run the Cockpit build:

```bash
npm run -w apps/cockpit build
```

Scan the generic Cockpit boundary:

```bash
rg -n "CustomerName|CustomerCollege|customer-extension|@customer" apps/cockpit packages/cockpit-extension-sdk -g "!node_modules"
```

## Beads-Style Backlog

| ID | Status | Item | Acceptance |
| --- | --- | --- | --- |
| CPS-001 | Done | Add generic `platform-showcase` fixture | Default demo dataset loads non-vertical mock data across core Cockpit surfaces |
| CPS-002 | Done | Remove extended vertical datasets from Cockpit | Settings and stored dataset resolution only support `platform-showcase` in mock mode |
| CPS-003 | Done | Gate robotics demo separately | Robotics nav, routes, and triage mode stay hidden unless the robotics flag is enabled |
| CPS-004 | Done | Make shell profile fallback access-aware | Default-route redirects and actions use active access context |
| CPS-005 | Done | Guard dataset mutation path | Programmatic dataset switch falls back to the default when passed a hidden dataset |
| CPS-006 | Done | Add route-level default-screen smoke coverage | `/`, `/dashboard`, settings, approvals, work items, runs, evidence, and config load against `platform-showcase` |
| CPS-007 | Done | Add sidebar inventory regression | Test or static check proves unrelated prototype sections are absent by default |
| CPS-008 | Done | Replace remaining static placeholder panels | Any core sidebar route should either use mock/live data or be hidden from the default shell |
| CPS-009 | Done | Exclude retired prototypes from production chunks | Production build emits `platform-showcase` only, not retired vertical/demo fixture chunks |

## Done Criteria

- Default Cockpit demo starts on generic Portarium data.
- Core visible sidebar routes render useful data or honest empty states.
- Legacy vertical prototypes are not in the active Cockpit source path.
- Production build excludes retired vertical prototype assets.
- Portarium stays free of customer-specific references.
- Tests and docs explain the mock/read-only boundary clearly.
