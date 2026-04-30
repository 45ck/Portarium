# Cockpit Live Release Gate

**Bead:** bead-1138
**Status:** accepted
**Reviewed:** 2026-04-30

This is the release gate for Cockpit operating against live control-plane data.
It complements the live-preview build gate in ADR-0127 by requiring seeded API
reads, one persisted UI write path, and agent-browser evidence.

## Latest Live-Stack Evidence

Latest curated evidence:
`docs/internal/review/artifacts/bead-1138/live-stack/latest/index.json`

Local raw captures:
`qa-artifacts/manual-evidence/bead-1138/`

## Release Gate Criteria

1. `npm run ci:cockpit:live-stack-smoke:required` exits 0 against a seeded local stack.
2. The Playwright smoke runs with `VITE_PORTARIUM_ENABLE_MSW=false`.
3. The smoke verifies seeded runs, approvals, work items, run evidence, and one approval decision write.
4. The approval write is verified through an independent API read after the UI action.
5. The agent-browser checklist passes against `http://cockpit.localhost:1355`.
6. Evidence includes runs, evidence, and approval-decision screenshots, a trace zip, and console/error output.

## Required Commands

```powershell
npm run dev:all
npm run seed:cockpit-live
npm run ci:cockpit:live-stack-smoke:required
```

For manual evidence:

```powershell
$env:VITE_PORTARIUM_API_BASE_URL = "http://localhost:8080"
$env:VITE_PORTARIUM_ENABLE_MSW = "false"
npm run cockpit:dev
```

Then run `docs/internal/qa/cockpit-live-agent-browser-checklist.md`.

## Required Artifacts

| Artifact                 | Path                                                                    |
| ------------------------ | ----------------------------------------------------------------------- |
| Automated smoke manifest | `playwright-report/live-stack/`                                         |
| Playwright attachments   | `qa-artifacts/playwright-live-stack/`                                   |
| Manual raw evidence      | `qa-artifacts/manual-evidence/bead-1138/`                               |
| Curated release evidence | `docs/internal/review/artifacts/bead-1138/live-stack/<stamp>/`          |
| Latest evidence manifest | `docs/internal/review/artifacts/bead-1138/live-stack/latest/index.json` |
| Agent-browser checklist  | `docs/internal/qa/cockpit-live-agent-browser-checklist.md`              |

## Residual Unsupported Surfaces

- Robotics Cockpit routes remain explicitly gated unless live telemetry support is enabled.
- Workflow builder mutation coverage is outside this smoke; it remains covered by mock-mode and contract tests.
- The live smoke uses the local development web session path. Staging and production OIDC/JWT hardening is tracked by the production auth gate.
- Agent-browser evidence is manual release evidence, not a substitute for the automated Playwright smoke.

## Related References

- ADR-0127: `docs/internal/adr/ADR-0127-cockpit-live-preview-ci-gate.md`
- Local live stack: `docs/getting-started/local-dev.md`
- Agent-browser checklist: `docs/internal/qa/cockpit-live-agent-browser-checklist.md`
