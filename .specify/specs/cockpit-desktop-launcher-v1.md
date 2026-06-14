# Spec: Cockpit Desktop Launcher (v1)

## Context

Portarium Cockpit is primarily a web application and PWA. Operators also need a low-friction desktop entry point for local development, demos, and private deployments where the Cockpit URL already exists.

This spec defines a Windows desktop launcher that opens Cockpit in a dedicated browser app window. It is not a native business-logic shell, service manager, tunnel manager, credential broker, or action executor.

## Requirements

1. The launcher must support `Status`, `Install`, `Launch`, and `Uninstall` modes.
2. `Install` must create a Start Menu shortcut and, by default, a Desktop shortcut.
3. Shortcuts must be configurable by app name, shortcut name, target URL, state directory, profile directory, icon path, and Start Menu group.
4. `Launch` must open Microsoft Edge or Google Chrome in app mode against the configured Cockpit URL.
5. `Launch` must use a dedicated browser profile directory and must not inspect cookies, local storage, saved passwords, session state, or browser profile contents.
6. The launcher must emit a JSON report for every mode.
7. The launcher must be reusable by deployment-specific wrappers through a custom shortcut command path and arguments.
8. The launcher must fail closed when no supported browser is found.
9. The launcher must guard profile deletion so `Uninstall -RemoveProfile` cannot remove paths outside the configured state directory.
10. The launcher must not start Portarium services, create tunnels, alter DNS, mutate provider accounts, make approval decisions, execute actions, or broaden network exposure.

## Acceptance

- `scripts/desktop/portarium-cockpit-desktop.ps1` implements the four modes.
- `package.json` exposes `cockpit:desktop:status`, `cockpit:desktop:install`, `cockpit:desktop:launch`, and `cockpit:desktop:uninstall`.
- `docs/how-to/cockpit-desktop-launcher.md` documents the default and custom deployment flows.
- `Status` works without creating shortcuts.
- `Install` can be run while Cockpit is not currently reachable and still installs the launcher.
- Deployment-specific readiness, authentication, and tunnel setup remain outside the generic launcher.
