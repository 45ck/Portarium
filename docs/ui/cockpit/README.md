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

## Robotics Map Prototype Highlights

- `Robots` now defaults to `Operations Map` (overview-first map + synchronized list).
- Map controls include:
  - Site/floor filters
  - Status filter chips
  - Layer toggles (occupancy, geofences, trails, uncertainty, clusters)
  - Live/replay timeline with incident bookmarks
- Alert triage includes map jump and acknowledge actions.
- Details-on-demand panel updates from map/list/alert selection.
- Degraded realtime state shows a map staleness banner.

## Domain Primitives Rendered

All 20 domain primitives from `ux-ideas.json` are rendered somewhere in this prototype:

`tier_indicator`, `sod_constraint_badge`, `port_family_icon`, `drift_indicator`, `idempotency_badge`, `next_action_prompt`, `effects_diff`, `plan_review_block`, `approval_gate_panel`, `rationale_thread`, `run_state_machine`, `policy_eval_card`, `correlation_thread`, `sor_ref_cluster`, `evidence_chain_viewer`, `chain_integrity_banner`, `retention_indicator`, `canonical_object_card`, `work_item_binder`, `capability_matrix_grid`

Notes:

- This prototype is intentionally low fidelity (structure + flows, not visual design).
- Layout and copy are derived from `docs/ui/ux-ideas.json` composition 201.
