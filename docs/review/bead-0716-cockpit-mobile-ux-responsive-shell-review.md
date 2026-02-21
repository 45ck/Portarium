# Review: bead-0716 (Cockpit mobile UX responsive shell and core flow hardening)

## Scope

- Complete phone-viewport cockpit shell behavior for core operational flows.
- Expose persona/workspace controls in mobile navigation surface.
- Harden shared layout components to avoid narrow-width overflow regressions.
- Add mobile-specific route verification and breakpoint evidence.

## Changes

- Mobile shell updates:
  - `apps/cockpit/src/components/cockpit/mobile-bottom-nav.tsx`
    - Added mobile context controls in `More` drawer:
      - Persona selector
      - Workspace selector
    - Added explicit accessible labels for nav links and drawer trigger.
    - Switched component to receive workspace/persona state from root shell.
  - `apps/cockpit/src/routes/__root.tsx`
    - Passed workspace/persona state and setters into `MobileBottomNav`.
    - Added `overflow-x-hidden` to main shell container to prevent horizontal page scroll.
- Responsive UI hardening:
  - `apps/cockpit/src/components/cockpit/page-header.tsx`
    - Header action row now stacks on narrow widths (`flex-col` on mobile).
  - `apps/cockpit/src/components/cockpit/filter-bar.tsx`
    - Filter controls now wrap and use full-width triggers on phone viewports.
- Mobile V&V:
  - `apps/cockpit/src/routes/mobile-shell.test.tsx` (new)
    - Verifies mobile bottom nav renders.
    - Verifies mobile context controls are reachable from drawer.
    - Verifies core flow routes render on phone viewport (`/approvals`, `/work-items`, `/runs`, `/workflows/:id`).
    - Verifies workflow detail retains edit affordance on mobile.
- Breakpoint QA evidence:
  - `scripts/qa/capture-cockpit-mobile-breakpoints.mjs` (new)
  - `docs/review/artifacts/bead-0716/mobile-breakpoints/*`
    - Mobile + desktop screenshots for approvals, work items, runs, workflow builder
    - metadata in `index.json`
- Spec update:
  - `.specify/specs/cockpit-mobile-responsive-shell-v1.md` (new)

## Validation

- `npm run cockpit:qa:mobile-breakpoints`
- `npm run test -- apps/cockpit/src/routes/mobile-shell.test.tsx`
- `npm run ci:pr`

## Risk

- Medium-low.
- Changes are presentation-layer focused and backed by route-level mobile tests and visual evidence.
