# Cockpit Desktop Launcher

This guide documents the Windows desktop launcher for Portarium Cockpit.

The launcher opens an existing Cockpit URL in Microsoft Edge or Google Chrome app mode with a dedicated browser profile. It creates local shortcuts and a generated icon, but it does not start services, create tunnels, configure authentication, or execute Portarium actions.

## Included Tooling

- Script: `scripts/desktop/portarium-cockpit-desktop.ps1`
- Npm entries:
  - `npm run cockpit:desktop:status`
  - `npm run cockpit:desktop:install`
  - `npm run cockpit:desktop:launch`
  - `npm run cockpit:desktop:uninstall`

Default target URL: `http://127.0.0.1:1355/`

## Local Dev Flow

Start Cockpit first:

```powershell
npm run cockpit:dev
```

In another terminal, install the desktop launcher:

```powershell
npm run cockpit:desktop:install
```

Launch it:

```powershell
npm run cockpit:desktop:launch
```

Check status:

```powershell
npm run cockpit:desktop:status
```

Remove shortcuts:

```powershell
npm run cockpit:desktop:uninstall
```

Remove shortcuts and the dedicated browser profile:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\desktop\portarium-cockpit-desktop.ps1 -Mode Uninstall -RemoveProfile
```

## Custom Deployment URL

Use `-TargetUrl` when Cockpit is served somewhere else:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\desktop\portarium-cockpit-desktop.ps1 -Mode Install -TargetUrl "http://127.0.0.1:11355/config/agents/agent-openclaw-gateway-demo" -AppName "Portarium Cockpit" -ShortcutName "Portarium Cockpit"
```

By default, `Launch` opens even if the target is not reachable. Add `-RequireReady` when the caller should fail instead:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\desktop\portarium-cockpit-desktop.ps1 -Mode Launch -TargetUrl "http://127.0.0.1:11355/" -RequireReady
```

## Deployment-Specific Wrappers

Private deployments can keep their policy and access checks in their own wrapper while still using Portarium's shortcut and browser-app support. Pass `-ShortcutCommandPath` and `-ShortcutCommandArguments` during install so the shortcut calls the deployment wrapper first.

Example:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\desktop\portarium-cockpit-desktop.ps1 `
  -Mode Install `
  -TargetUrl "http://127.0.0.1:11355/config/agents/agent-openclaw-gateway-demo" `
  -AppName "Calvin Portarium" `
  -ShortcutName "Calvin Portarium" `
  -StartMenuGroup "Calvin Ops" `
  -ShortcutCommandPath "powershell.exe" `
  -ShortcutCommandArguments "-NoProfile -ExecutionPolicy Bypass -File `"E:\calvin-ops\scripts\portarium-desktop-app.ps1`" -Mode Launch -Root `"E:\calvin-ops`" -Target Agent"
```

That pattern keeps readiness, tunnels, identity, and policy gates in the deployment wrapper, while the open-source launcher owns only the desktop shell mechanics.

## Boundaries

- Local Windows shortcuts and browser app mode only.
- Dedicated browser profile; no profile inspection.
- No service startup, tunnel creation, DNS, billing, provider mutation, approval decision, or action execution.
- No credentials or browser state are read or printed.
