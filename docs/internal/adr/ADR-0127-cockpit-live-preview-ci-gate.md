# ADR-0127: Cockpit Live Preview CI Gate

**Beads:** bead-1132
**Status:** Accepted
**Date:** 2026-04-30

## Context

Cockpit is being moved from a demo-oriented UI toward a live-data operator
surface. A successful production bundle alone does not prove that the built
application can boot in a browser with mocks disabled, real API routing enabled,
and static assets resolved from the generated artifact.

Before this decision, `ci:pr` built Cockpit and Storybook but did not run a
browser smoke check against a production Cockpit artifact configured like a live
preview. That left regressions in runtime boot, asset serving, mock leakage, and
API-base assumptions to be found manually.

ADR-0041 treats package-level gate changes as quality-critical. This decision
records the intentional `package.json` gate baseline change for bead-1132.

## Decision

Add a Cockpit live-preview build and browser smoke gate to `ci:pr`.

- `npm run cockpit:build` remains the normal production build gate.
- `npm run cockpit:build:live-preview` creates a separate
  `apps/cockpit/dist-live-preview` artifact.
- The live-preview build disables MSW at build time and sets a non-demo API base
  suitable for same-origin smoke testing.
- `npm run cockpit:preview-smoke` serves the live-preview artifact, stubs the
  expected control-plane API paths at the same origin, opens the built app in
  Chromium, and fails on runtime errors or missing static assets.
- The live-preview artifact is ignored as generated output and is not allowed to
  overwrite the normal production `dist` artifact.

## Consequences

Positive:

- `ci:pr` now proves that Cockpit can boot from a built artifact with mock
  worker startup disabled.
- Static asset regressions, top-level runtime errors, and shallow API-base drift
  are caught before merge.
- The normal production artifact remains separate from live-preview smoke
  evidence.

Negative:

- `ci:pr` runs an additional Cockpit build and Chromium smoke test.
- The smoke gate is intentionally shallow; it verifies boot and first-screen
  viability, not every live workflow.
- Real backend parity, authentication, freshness, and tenant data isolation
  remain tracked by the follow-on live-data readiness beads.

## Alternatives Considered

- Reuse `apps/cockpit/dist` for smoke testing.
  - Rejected because live-preview-specific environment settings would make the
    normal production artifact harder to reason about.
- Rely only on unit tests and `cockpit:build-storybook`.
  - Rejected because neither proves that the generated app boots in a browser
    with live-preview settings.
- Run the smoke test against the development server.
  - Rejected because the risk being gated is the production artifact, not Vite
    development middleware.

## Implementation Mapping

- `package.json` wires the live-preview build and smoke commands into `ci:pr`.
- `scripts/ci/build-cockpit-live-preview.mjs` creates the separate live-preview
  artifact with mock worker startup disabled.
- `scripts/ci/check-cockpit-preview-smoke.mjs` serves and checks the artifact in
  Chromium.
- `apps/cockpit/.gitignore` and `.prettierignore` keep
  `dist-live-preview` treated as generated output.

## Remaining Gap Tracking

- API-contract and endpoint parity work remains in bead-1127 through bead-1130.
- Mock-fixture isolation remains in bead-1136.
- Production origin and JWT hardening remains in bead-1135.
- Live-stack smoke with agent-browser evidence remains in bead-1138.
