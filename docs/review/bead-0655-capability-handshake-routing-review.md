# Review: bead-0655 (Capability Handshake for Agent Routing)

Reviewed on: 2026-02-20

Scope:

- `src/domain/primitives/index.ts`
- `src/domain/machines/capability-handshake-v1.ts`
- `src/domain/machines/capability-handshake-v1.test.ts`
- `src/domain/machines/machine-registration-v1.ts`
- `src/domain/machines/machine-registration-v1.test.ts`
- `src/application/commands/machine-agent-registration.ts`
- `src/application/commands/machine-agent-registration.test.ts`
- `.specify/specs/machine-agent-registration-commands-v1.md`

## Findings

High:

- none.

Medium:

- none.

Low:

- none.

## Verification Evidence

- Confirmed new `CapabilityDescriptor` domain value object and capability-handshake routing logic.
- Confirmed branded primitive `CapabilityKey` is defined and used by machine capability descriptors.
- Confirmed `createAgent` enforces handshake and rejects non-routable agent capabilities.
- Confirmed routing logic unit tests cover route + deny outcomes with explicit deny reasons.
- Confirmed spec update documents handshake/routing behavior and acceptance criteria coverage.
