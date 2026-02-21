# Review: bead-0715 (Cockpit mobile foundation OpenAPI client alignment)

## Scope

- Consolidate Cockpit core entity API usage behind one typed control-plane client.
- Align endpoint naming and type parity with OpenAPI for mobile foundation work.
- Add CI drift enforcement for cockpit-facing core entity operations.

## Changes

- Added shared client:
  - `apps/cockpit/src/lib/control-plane-client.ts`
  - base URL via `VITE_PORTARIUM_API_BASE_URL`
  - bearer token injection via env/localStorage
  - `problem+json` normalization via `CockpitApiError`
- Migrated core hooks/routes to shared client:
  - `apps/cockpit/src/hooks/queries/use-approvals.ts`
  - `apps/cockpit/src/hooks/queries/use-runs.ts`
  - `apps/cockpit/src/hooks/queries/use-work-items.ts`
  - `apps/cockpit/src/hooks/queries/use-workflows.ts`
  - `apps/cockpit/src/routes/approvals/index.tsx`
  - `apps/cockpit/src/routes/runs/$runId.tsx`
  - `apps/cockpit/src/components/cockpit/start-run-dialog.tsx`
- Contract parity updates:
  - approvals decision path aligned to `/decide`
  - work item status union aligned with OpenAPI enum in `src/presentation/ops-cockpit/types.ts`
- CI drift check added:
  - `scripts/ci/check-cockpit-api-drift.mjs`
  - `package.json` scripts: `ci:cockpit:api-drift`, wired into `ci:pr`
- Added validation test coverage:
  - `apps/cockpit/src/lib/control-plane-client.test.ts`

## Validation

- `npm run ci:pr`

## Risk

- Medium-low.
- Surface-area change spans multiple hooks/routes but is constrained to API boundary wiring and type alignment.
