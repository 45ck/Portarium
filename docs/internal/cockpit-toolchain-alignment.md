# Cockpit Toolchain Alignment: Root-Cause Matrix and Resolution

**Beads**: bead-0855, bead-0856, bead-0860 (coordinator)
**Date**: 2026-03-02

## Root-Cause Matrix

| Failure                                   | Gate affected             | Root cause                                                                                                                                                                                                                                  | Fix (bead)                                                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cannot find module @testing-library/dom` | `cockpit:test:coverage`   | `@testing-library/react` peer-depends on `@testing-library/dom` but cockpit workspace `package.json` omitted it. Hoisting from root masked the gap locally; `npm ci` in isolated CI fails.                                                  | Added `@testing-library/dom` `^10.0.0` to `apps/cockpit/package.json` devDependencies and synchronized `package-lock.json` (bead-0855).                                                                                                                  |
| `storybook is not recognized`             | `cockpit:build-storybook` | Storybook CLI (`storybook` binary) was not available in the workspace execution path. The `@storybook/react-vite` package was listed but the top-level `storybook` package (which provides the CLI) was not wired for workspace resolution. | Integrated Storybook build into `ci:pr` gate, then completed the clean-install fix by adding the workspace `storybook` package, switching story helpers to `storybook/test`, and configuring Capacitor stub resolution for web/test tooling (bead-0885). |

## Compatibility Verification

Both fixes share `apps/cockpit/package.json` and the root `package-lock.json`. The following validates they compose without conflict:

1. **Lockfile consistency**: `npm ls --all` resolves without peer-dependency warnings for `@testing-library/*` and `@storybook/*` trees.
2. **Cockpit unit coverage**: 217 tests pass, all thresholds met (statements 90.9%, branches 82.8%, functions 83.7%, lines 92.1%).
3. **Storybook build**: `cockpit:build-storybook` completes in ~7s, output at `apps/cockpit/storybook-static/`.
4. **Full `ci:pr` gate**: typecheck, lint, format, spell, depcruise, knip, unit tests, cockpit coverage, and Storybook build all pass.

## Dependency Graph (testing-library)

```
apps/cockpit/package.json (devDependencies)
  @testing-library/dom       ^10.0.0   (NEW — bead-0855)
  @testing-library/react     ^16.0.0   (existing)
    peerDep: @testing-library/dom ^10.0.0
  @testing-library/user-event ^14.5.2  (existing)
    peerDep: @testing-library/dom >=7.21.4
```

## Lessons Learned

- Peer dependencies that are satisfied by hoisting in monorepo `npm install` may fail under `npm ci` or strict workspace isolation. Always declare peer deps explicitly in the consuming workspace.
- Storybook CLI availability depends on the `storybook` meta-package being resolvable from the workspace scripts context, and Storybook-owned helpers should come from `storybook/*` entrypoints that match the installed CLI major.
- Junction-linked `node_modules` in git worktrees can cause duplicate React copies; `resolve.dedupe` in Vite config is required.
