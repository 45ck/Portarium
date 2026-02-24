# Review: bead-0657 (Capability Handshake and Drift Quarantine for Agent Routing)

Reviewed on: 2026-02-20

Scope:

- `src/domain/machines/machine-registration-v1.ts`
- `src/domain/machines/machine-registration-v1.test.ts`
- `src/application/commands/machine-agent-registration.ts`
- `src/application/commands/machine-agent-registration.test.ts`
- `src/application/integration/agent-capability-drift-quarantine.integration.test.ts`
- `src/application/queries/get-agent-work-items.test.ts`
- `.specify/specs/machine-agent-registration-commands-v1.md`

## Findings

High:

- none.

Medium:

- none.

Low:

- none.

## Verification Evidence

- Confirmed machine and agent parsing now persist canonical capability descriptors (`entity:verb`) for routing checks.
- Confirmed `createAgent` performs capability handshake against declared agent capabilities and rejects non-routable declarations.
- Confirmed drift quarantine compares baseline vs observed capability descriptors for agent re-registration and denies side effects on unreviewed drift.
- Confirmed policy-tier blast-radius validation remains enforced for `allowedTools`.
- Confirmed targeted tests pass:
  - `src/domain/machines/capability-handshake-v1.test.ts`
  - `src/domain/machines/capability-drift-quarantine-policy-v1.test.ts`
  - `src/domain/machines/machine-registration-v1.test.ts`
  - `src/application/commands/machine-agent-registration.test.ts`
  - `src/application/integration/agent-capability-drift-quarantine.integration.test.ts`
  - `src/application/queries/get-agent-work-items.test.ts`
