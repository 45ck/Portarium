# Plugin And Generated UI Pilot Red-Team Evidence

**Bead:** `bead-1152`
**Date:** 2026-05-03
**Mode:** production-like deterministic rehearsal
**Decision:** no blocking finding in the tested pilot path

## Scope

This red-team pass covers the contained pilot path called out by
`docs/internal/governance/pilot-readiness-decision-report.md`: one governed
Cockpit Extension and one agent-generated operator surface fixture. It tests
whether either path can bypass Policy, Approval Gates, Evidence, tenancy,
Browser Egress, or emergency disable.

The rehearsal uses the installed reference Cockpit Extension and a generated
`OperatorSurfaceV1` approval-scoped form. External System of Record effects stay
stubbed, matching the contained pilot boundary.

## Evidence Artifact

Curated evidence is recorded at
`docs/internal/review/artifacts/bead-1152/plugin-generated-ui-red-team/latest/index.json`.

The evidence captures:

- governed extension version pin and permission grant alignment;
- route, navigation, command, and shortcut suppression under emergency disable;
- route and command guard fail-closed behavior when authority context is weak or
  missing;
- Browser Egress denial before network dispatch, with policy, origin, path,
  Workspace, principal, route, and correlation audit metadata;
- generated operator surface parsing as typed schema data only;
- rejection of executable payload hints, hidden egress, hidden command fields,
  foreign Workspace context, and undeclared submitted values;
- `OperatorSurface` evidence entries linked to the originating Run and Approval
  Gate context for proposed, approved, rendered, and used lifecycle events.

## Validation

Focused checks:

```bash
node node_modules/vitest/vitest.mjs run scripts/integration/scenario-plugin-generated-ui-red-team.test.ts
npm run -w apps/cockpit test -- src/lib/extensions/plugin-generated-ui-pilot-red-team.test.ts
```

Full gate target:

```bash
npm run ci:pr
```

## Findings

No blocking bypass was found in this rehearsal. No follow-up Beads were created.

Residual risk remains that this is a production-like deterministic rehearsal,
not a headed live-stack operator session. That broader evidence remains covered
by the live-browser follow-up in the pilot readiness sequence.
