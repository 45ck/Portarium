# Cockpit Live Agent-Browser Checklist

**Bead:** bead-1138
**Scope:** live local Cockpit against the seeded control plane, with MSW disabled.

## Prerequisites

Run from the repository root:

```powershell
npm run dev:all
npm run seed:cockpit-live
npm run seed:cockpit-live:validate
$env:VITE_PORTARIUM_API_BASE_URL = "http://localhost:8080"
$env:VITE_PORTARIUM_ENABLE_MSW = "false"
npm run cockpit:dev
```

Use `http://cockpit.localhost:1355` for manual evidence. Store local captures
under `qa-artifacts/manual-evidence/bead-1138/` and promote curated release
evidence to `docs/internal/review/artifacts/bead-1138/live-stack/<stamp>/`.

## Checklist

| #   | Check                 | Command or action                                                                                                             | Pass | Fail | Evidence                  |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---- | ---- | ------------------------- |
| 1   | Open live Cockpit     | `$env:AGENT_BROWSER_SESSION = "cockpit-live"; npm run ab -- open http://cockpit.localhost:1355 --headed`                      | ☐    | ☐    |                           |
| 2   | Clear console buffer  | `$env:AGENT_BROWSER_SESSION = "cockpit-live"; npm run ab -- console --clear`                                                  | ☐    | ☐    |                           |
| 3   | Load runs             | Navigate to `/runs`; verify `run-live-001` and `run-live-002` are visible.                                                    | ☐    | ☐    | `runs.png`                |
| 4   | Inspect run evidence  | Open `/runs/run-live-001`, select **Evidence**, verify `ev-live-001` and `ev-live-002` summaries.                             | ☐    | ☐    | `evidence.png`            |
| 5   | Load work item        | Open `/work-items/wi-live-001`; verify linked run and evidence timeline render.                                               | ☐    | ☐    |                           |
| 6   | Complete approval     | Open `/approvals?focus=apr-live-001&from=notification`, enter rationale, approve, and wait for the decision to persist.       | ☐    | ☐    | `approval-decision.png`   |
| 7   | Verify persisted read | Reopen the focused approval URL and confirm it shows as already decided.                                                      | ☐    | ☐    |                           |
| 8   | Capture console state | `AGENT_BROWSER_SESSION=cockpit-live npm run ab -- console` and `npm run ab -- errors`; both must show no runtime errors.      | ☐    | ☐    | `console-errors.txt`      |
| 9   | Capture trace         | Use `trace start` before step 3 and `trace stop qa-artifacts/manual-evidence/bead-1138/agent-browser.trace.zip` after step 8. | ☐    | ☐    | `agent-browser.trace.zip` |

## Evidence Commands

```powershell
New-Item -ItemType Directory -Force qa-artifacts/manual-evidence/bead-1138
$env:AGENT_BROWSER_SESSION = "cockpit-live"
npm run ab -- trace start
npm run ab -- screenshot qa-artifacts/manual-evidence/bead-1138/runs.png --full
npm run ab -- screenshot qa-artifacts/manual-evidence/bead-1138/evidence.png --full
npm run ab -- screenshot qa-artifacts/manual-evidence/bead-1138/approval-decision.png --full
npm run ab -- console > qa-artifacts/manual-evidence/bead-1138/console-errors.txt
npm run ab -- errors >> qa-artifacts/manual-evidence/bead-1138/console-errors.txt
npm run ab -- trace stop qa-artifacts/manual-evidence/bead-1138/agent-browser.trace.zip
npm run ab -- close
```

Rerun `npm run seed:cockpit-live` before repeating the approval decision check;
the approval is intentionally mutated by the live write path.
