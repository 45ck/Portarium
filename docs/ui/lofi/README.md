# Low-Fi UI Prototype (v1)

This folder contains a low-fidelity, clickable prototype for the default Portarium UI (teams and individuals use the same UI).

## How To View

Option A (simplest):

- Open `docs/ui/lofi/index.html` in a browser.

Option B (recommended if your browser is strict about local files):

```powershell
cd C:\Projects\Portarium
npx --yes http-server docs/ui/lofi -p 4173
```

Then open `http://localhost:4173`.

## How To Use

- Use the left nav to switch screens:
  - Workspace Inbox, Project Overview, Work Items, Work Item Detail, Run Detail, Approvals, Evidence, Settings (stub)
- Use the top controls to simulate:
  - Persona defaults (Operator / Approver / Auditor / Admin)
  - Workspace type (Solo / Team)
  - System state (Normal / Empty / Misconfigured / Policy blocked / RBAC limited / Degraded realtime)

Notes:

- This prototype is intentionally low fidelity (structure + flows, not visual design).
- Copy and layout are derived from `docs/ui/project-ui-v1.md`.
