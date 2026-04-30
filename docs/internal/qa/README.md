# Portarium QA Checklists

Structured manual QA checklists for the Portarium Cockpit UI. Each checklist
targets a specific area and includes pass/fail columns for sign-off.

## Checklists

| Checklist                                                       | Scope                                                               | Personas          |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------- |
| [UI Smoke](./ui-smoke-checklist.md)                             | All routes load, layout intact, no console errors                   | Any               |
| [Approval Flow](./approval-flow-checklist.md)                   | Approve / Deny / Request Changes with rationale validation + SoD    | Alice (approver)  |
| [Run Management](./run-management-checklist.md)                 | Start / cancel / retry runs, status badge colours                   | Bob (operator)    |
| [RBAC](./rbac-checklist.md)                                     | Alice / Bob / Carol see correct menus, data, and actions            | Alice, Bob, Carol |
| [Responsive / Mobile](./responsive-mobile-checklist.md)         | < 640 px viewport, bottom nav, filter-bar wrap                      | Any               |
| [Error Handling](./error-handling-checklist.md)                 | RFC 7807 Problem Details, form validation, error boundary, offline  | Any               |
| [Live Agent-Browser](./cockpit-live-agent-browser-checklist.md) | Seeded live stack, approval write path, screenshots, trace, console | Approver          |

## How to use

1. Open the relevant checklist.
2. Work through each row in order.
3. Mark ☑ in the **Pass** column when the step succeeds.
4. Mark ☑ in the **Fail** column and add a note when a step fails.
5. File a GitHub issue for every **Fail**, linking to this checklist and the row number.

## Existing automated coverage

Before running manual checklists, confirm automated tests pass:

```bash
# Root backend tests
npm run test

# Cockpit component tests
npm run -w apps/cockpit test

# Full CI gate
npm run ci:pr
```

## Browser QA

Use the Node wrapper for scripted browser-based exploration. This avoids the
unsigned Rust CLI path that can be blocked by AppLocker on Windows Enterprise.

```bash
# Check daemon and browser discovery before starting a manual run
npm run ab -- doctor

# Launch Cockpit and take a snapshot of interactive elements
npm run ab -- open http://cockpit.localhost:1355 --headed
npm run ab -- snapshot -i

# Resize to a mobile approval-review viewport
npm run ab -- set viewport 390 844

# Capture a screenshot for evidence
npm run ab -- screenshot ./qa-artifacts/manual-evidence/smoke-$(date +%Y%m%d).png

# Close browser
npm run ab -- close
```

### Windows host prerequisites

- Install `agent-browser` globally, or set
  `AGENT_BROWSER_DAEMON_JS` to the package `dist/daemon.js` file.
- Install Google Chrome or Microsoft Edge. The wrapper discovers common Windows
  install locations and also accepts `AGENT_BROWSER_CHROME_EXECUTABLE`,
  `CHROME_PATH`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, or
  `npm run ab -- open <url> --chrome-path <path>`.
- Use a unique session when running in parallel:
  `AGENT_BROWSER_SESSION=mytest npm run ab -- open http://cockpit.localhost:1355 --headed`.
- Run `npm run ab -- doctor --json` when a host cannot launch a browser; it
  prints the daemon path, socket directory, session port, and browser executable
  the wrapper will use.
