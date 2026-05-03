# Cockpit Live Agent-Browser Checklist

**Bead:** bead-1155
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

Use `http://cockpit.localhost:1355` or the live-stack Vite URL for manual
evidence. Store local captures under `qa-artifacts/manual-evidence/bead-1155/`
and promote curated release evidence to
`docs/internal/review/artifacts/bead-1155/live-stack/<stamp>/`.

## Checklist

| #   | Check                 | Command or action                                                                                                                                   | Pass | Fail | Evidence                  |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- | ------------------------- |
| 1   | Open live Cockpit     | `$env:AGENT_BROWSER_SESSION = "cockpit-live"; npm run ab -- open http://cockpit.localhost:1355 --headed`                                            | ☐    | ☐    |                           |
| 2   | Clear console buffer  | `$env:AGENT_BROWSER_SESSION = "cockpit-live"; npm run ab -- console --clear`                                                                        | ☐    | ☐    |                           |
| 3   | Load runs             | Navigate to `/runs`; verify `run-live-001` and `run-live-002` are visible.                                                                          | ☐    | ☐    | `runs.png`                |
| 4   | Inspect run evidence  | Open `/runs/run-live-001`, select **Evidence**, verify `ev-live-001` and `ev-live-002` summaries.                                                   | ☐    | ☐    | `evidence.png`            |
| 5   | Load work item        | Open `/work-items/wi-live-001`; verify linked run and evidence timeline render.                                                                     | ☐    | ☐    |                           |
| 6   | Complete approval     | Open `/approvals?focus=apr-live-001&from=notification`, verify Approve and Request Changes controls, submit one decision, and wait for persistence. | ☐    | ☐    | `approval-decision.png`   |
| 7   | Resume run            | Open `/runs/run-live-001`, record a Resume intervention, and verify the run returns to `Running`.                                                   | ☐    | ☐    | `run-resume.png`          |
| 8   | Verify persisted read | Reopen the focused approval URL and confirm it shows as already decided; verify Evidence has no exposed token or secret text.                       | ☐    | ☐    |                           |
| 9   | Capture console state | `AGENT_BROWSER_SESSION=cockpit-live npm run ab -- console` and `npm run ab -- errors`; both must show no runtime errors.                            | ☐    | ☐    | `console-errors.txt`      |
| 10  | Capture trace         | Use `trace start` before step 3 and `trace stop qa-artifacts/manual-evidence/bead-1155/agent-browser.trace.zip` after step 9.                       | ☐    | ☐    | `agent-browser.trace.zip` |

## Evidence Commands

```powershell
New-Item -ItemType Directory -Force qa-artifacts/manual-evidence/bead-1155
$env:AGENT_BROWSER_SESSION = "cockpit-live"
npm run ab -- trace start
npm run ab -- screenshot qa-artifacts/manual-evidence/bead-1155/runs.png --full
npm run ab -- screenshot qa-artifacts/manual-evidence/bead-1155/evidence.png --full
npm run ab -- screenshot qa-artifacts/manual-evidence/bead-1155/approval-decision.png --full
npm run ab -- screenshot qa-artifacts/manual-evidence/bead-1155/run-resume.png --full
npm run ab -- console > qa-artifacts/manual-evidence/bead-1155/console-errors.txt
npm run ab -- errors >> qa-artifacts/manual-evidence/bead-1155/console-errors.txt
npm run ab -- trace stop qa-artifacts/manual-evidence/bead-1155/agent-browser.trace.zip
npm run ab -- close
```

Rerun `npm run seed:cockpit-live` before repeating the approval decision check;
the approval is intentionally mutated by the live write path.
