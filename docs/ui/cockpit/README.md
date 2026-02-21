# Portarium Cockpit Lo-Fi Prototype

This folder contains a low-fidelity, clickable prototype for the Portarium Cockpit (composition 201 from `docs/ui/ux-ideas.json`). The Cockpit is a persona-adaptive shell with the Work Item as the gravitational centre, a correlation drawer for cross-entity tracing, and mode-switched panels.

## How To View

Option A (simplest):

- Open `docs/ui/cockpit/index.html` in a browser.

Option B (recommended if your browser is strict about local files):

```powershell
cd C:\Projects\Portarium
npx --yes http-server docs/ui/cockpit -p 4174
```

Then open `http://localhost:4174`.

## How To Use

- Use the left nav to switch screens:
  - Inbox, Project Overview, Work Items, Work Item Detail, Run Detail, Approvals, Evidence, Settings
  - Robotics: Robots (Operations Map), Missions, Safety, Gateways
- Use the top controls to simulate:
  - Persona defaults (Operator / Approver / Auditor / Admin)
  - Workspace type (Solo / Team)
  - System state (Normal / Empty / Misconfigured / Policy blocked / RBAC limited / Degraded realtime)
- Click correlation links, SoR ref chips, or the "Context" button to open the right drawer.
- The status bar at the bottom shows Run progress, chain integrity, and event stream health.

## Demo Automation Locators

For scripted demo capture, prefer target-intent selectors (`data-testid`) over CSS shape selectors.
The prototype exposes stable anchors for the core demo storyline:

- Nav: `demo-nav-inbox`, `demo-nav-work-item`, `demo-nav-runs`, `demo-nav-approvals`, `demo-nav-evidence`, `demo-nav-settings`
- Screens: `demo-screen-inbox`, `demo-screen-work-item`, `demo-screen-run`, `demo-screen-approvals`, `demo-screen-evidence`, `demo-screen-settings`

When updating layout/styling, keep these test IDs stable or update the corresponding test at
`src/presentation/ops-cockpit/cockpit-demo-locators.test.ts` and demo scripts together.
For scripted clip specs and runbook, see `docs/ui/cockpit/demo-machine/README.md`.

## Robotics Map Prototype Highlights

- `Robots` now defaults to `Operations Map` (overview-first map + synchronized list).
- Map renderer now uses `Leaflet` in low-fidelity mode with static fallback when CDN is unavailable.
- Map controls include:
  - Site/floor filters
  - Explicit floor switching with cross-floor context callout
  - 2D default view with optional 3D beta toggle for ramp/mezzanine context
  - Status filter chips
  - Layer toggles (occupancy, geofences, trails, uncertainty, clusters, coverage heatmap, dwell hotspots, utilisation summary)
  - Analytics window selector (15m / 1h / 4h / 24h) with explicit legend/title window labels
  - Sampling caveat + query-limit notes rendered inline to reduce analytics misinterpretation
  - Live/replay timeline with incident bookmarks
- Performance budget callout is shown inline for desktop/mobile map rendering expectations.
- Analytics query constraints are documented in-surface:
  - `15m` max `25k` points, target overlay refresh `<= 350ms`
  - `1h` max `100k` points, target refresh `<= 650ms`
  - `4h` max `300k` points, target refresh `<= 1.2s`
  - `24h` max `1M` points, target refresh `<= 2.5s`
- Alert triage includes map jump and acknowledge actions.
- Details-on-demand panel updates from map/list/alert selection.
- Degraded realtime state shows a map staleness banner.

## Workflow Builder Prototype Highlights

- Example blueprints include finance, robotics, machine maintenance, hybrid incidents, IT major incident, and compliance legal hold.
- Nodes are selectable in both template graphs and non-template workflow visualizations.
- Palette step types can append low-fi draft nodes into the active graph.
- Branch labels and connectors support low-fi editing interactions.
- Readiness panel blocks `Run workflow` when blocking validation checks remain.
- Keyboard support in builder:
  - `j`/`k` cycle active-graph nodes
  - `Enter` selects the focused step
  - `E` focuses step-name config input

## Domain Primitives Rendered

All 20 domain primitives from `ux-ideas.json` are rendered somewhere in this prototype:

`tier_indicator`, `sod_constraint_badge`, `port_family_icon`, `drift_indicator`, `idempotency_badge`, `next_action_prompt`, `effects_diff`, `plan_review_block`, `approval_gate_panel`, `rationale_thread`, `run_state_machine`, `policy_eval_card`, `correlation_thread`, `sor_ref_cluster`, `evidence_chain_viewer`, `chain_integrity_banner`, `retention_indicator`, `canonical_object_card`, `work_item_binder`, `capability_matrix_grid`

Notes:

- This prototype is intentionally low fidelity (structure + flows, not visual design).
- Layout and copy are derived from `docs/ui/ux-ideas.json` composition 201.

## Mocked Demo Mode (Backend-Free)

The cockpit now includes a frontend-only mock API layer for high-fidelity demos without a backend.

- Fixtures live at `docs/ui/cockpit/fixtures/demo.json`.
- Mock route interception is implemented in `docs/ui/cockpit/mock-api.js`.
- A thin frontend DAL lives in `docs/ui/cockpit/api-client.js`.
- UI hydration and decision-flow updates live in `docs/ui/cockpit/demo-bindings.js`.

### Demo API Routes (in-browser)

- `GET /api/connectors`
- `GET /api/work-items`
- `GET /api/work-items/:id`
- `GET /api/runs`
- `GET /api/runs/:id`
- `GET /api/approvals`
- `POST /api/approvals/:id/decision`
- `GET /api/evidence`
- `POST /api/demo/reset`

### Demo Flow

1. Open the cockpit and review the top pending Work Item.
2. Navigate to Run detail and submit an approval decision.
3. Observe updates to Work Item/Run/Approvals state and Evidence entries.
4. Use `Reset demo state` in the status bar to return to the deterministic start state.

## Asset Pipeline (Hi-fi App)

The high-fidelity app in `apps/cockpit` now has a manifest-based asset pipeline for
domain icons and entity imagery.

- Guidelines: `docs/ui/cockpit/assets-guidelines.md`
- Prompt catalog: `docs/assets/prompts/cockpit-entity-assets.yml`
- Runtime manifest: `apps/cockpit/src/assets/manifest.json`
