# OpenClaw Tool Blast-Radius Policy

**Beads:** bead-0444  
**Status:** Accepted  
**Date:** 2026-02-20

## Policy Statement

Portarium classifies OpenClaw Gateway tool and skill identifiers into risk categories and enforces a minimum execution tier per category.

If a tool is requested under a tier lower than its minimum, execution is denied and the run is surfaced as `PolicyBlocked`.

## Tool/Skill Category Mapping

| Category | Minimum tier | Typical patterns | Governance rationale |
| --- | --- | --- | --- |
| `ReadOnly` | `Auto` | `read`, `get`, `list`, `search`, `query`, `inspect` | Read-only retrieval and analysis are low blast radius and can run automatically. |
| `Mutation` | `HumanApprove` | `write`, `create`, `update`, `delete`, `send`, `publish`, `transfer` | Mutations can change external system state and require human approval by default. |
| `Dangerous` | `ManualOnly` | `shell`, `terminal`, `powershell`, `bash`, `cmd`, `system.exec`, `browser`, `playwright`, `puppeteer`, `selenium` | Command execution and browser automation can cause broad unintended effects; keep manually governed. |
| `Unknown` | `HumanApprove` | Unclassified custom names | Fail-safe default for unmapped identifiers. |

## Enforcement Semantics

1. Classify tool/skill identifier.
2. Compare workspace policy tier with category minimum tier.
3. Allow only when policy tier is equal to or stricter than minimum.
4. On violation, return `Deny` with run state `PolicyBlocked`.

## CI Evidence

Unit tests enforce that dangerous tools cannot auto-run and that denied evaluations produce `PolicyBlocked`:

- `src/domain/machines/openclaw-tool-blast-radius-v1.test.ts`
- `src/domain/machines/machine-registration-v1.test.ts`

Agent registration parsing also rejects `allowedTools` that exceed the configured policy tier:

- `src/domain/machines/machine-registration-v1.ts`
