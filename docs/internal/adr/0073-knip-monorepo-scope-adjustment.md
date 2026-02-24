# ADR-0073: Knip Monorepo Scope Adjustment

**Status:** Accepted
**Date:** 2026-02-21

## Context

Knip's dead-code/unused-dependency analysis runs from the project root. Three
classes of false positives accumulated after the cockpit workspace and new
infrastructure adapters were added:

1. **`apps/cockpit`** — a Remix/React workspace with its own `package.json`.
   Knip would attempt to resolve exports across the workspace boundary, producing
   misleading "unused export" results for symbols that are actually consumed
   within the cockpit sub-package.

2. **`@aws-sdk/client-s3`, `pg`, `@opentelemetry/api`** — runtime dependencies
   loaded through infrastructure adapter layers. They are not directly imported
   in TypeScript source files tracked by the root project's knip configuration,
   so knip misclassifies them as unused.

## Decision

- Set `"ignoreWorkspaces": ["apps/cockpit"]` — excludes the cockpit sub-workspace
  from the root-level knip analysis. Cockpit has its own tooling boundary and is
  reviewed separately.
- Add `@aws-sdk/client-s3`, `@opentelemetry/api`, and `pg` to `ignoreDependencies`
  — these are required runtime packages that appear unused only due to dynamic/
  indirect loading patterns that knip cannot trace statically.

## Consequences

- False positives eliminated; knip output is now actionable.
- The cockpit workspace is not dead-code-checked at the root level; a follow-up
  task should configure knip inside `apps/cockpit` if that analysis is wanted.
- Gate baseline updated to reflect the new `knip.json` hash.
