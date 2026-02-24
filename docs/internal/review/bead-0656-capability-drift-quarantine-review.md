# Review: bead-0656 (Capability Drift Quarantine Policy)

Reviewed on: 2026-02-20

Scope:

- `src/domain/machines/capability-drift-quarantine-policy-v1.ts`
- `src/domain/machines/capability-drift-quarantine-policy-v1.test.ts`
- `src/application/commands/machine-agent-registration.ts`
- `src/application/commands/machine-agent-registration.test.ts`
- `src/application/integration/agent-capability-drift-quarantine.integration.test.ts`
- `src/infrastructure/evidence/agent-action-evidence-hooks.ts`
- `.specify/specs/machine-agent-registration-commands-v1.md`

## Findings

High:

- none.

Medium:

- none.

Low:

- none.

## Verification Evidence

- Confirmed capability drift policy detects added/removed capability declarations for
  heartbeat/re-registration sources.
- Confirmed unreviewed drift returns quarantine decision with side-effect denial mapping.
- Confirmed `createAgent` applies re-registration drift check and returns quarantine conflict on
  drift.
- Confirmed integration flow test enforces quarantine and preserves the original stored
  capabilities.
- Confirmed event-hook type narrowing fix keeps `SupportedAgentActionEventType` sound under
  typecheck.
