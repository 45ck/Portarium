# Review: bead-0634 (ADR-0072 Implementation Mapping Closure)

Reviewed on: 2026-02-20

Scope:

- `docs/internal/adr/0072-openclaw-gateway-multi-tenant-isolation.md`
- `docs/internal/governance/openclaw-workspace-gateway-provisioning-runbook.md`
- `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.ts`
- `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.test.ts`
- `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.integration.test.ts`
- `src/presentation/runtime/control-plane-handler.machine-agent.contract.test.ts`

## Findings

High:

- none.

Medium:

- none.

Low:

- none.

## Acceptance Evidence

ADR implementation linkage added:

- Added explicit ADR-0072 mapping to existing implementation/review coverage:
  - `bead-0445`
  - `bead-0435`
  - `bead-0436`
  - `bead-0441`
  - `bead-0442`

Evidence pointers added in ADR:

- Workspace-scoped Gateway provisioning and runbook controls.
- OpenClaw adapter enforcement path with policy-denied fail-closed behavior.
- Contract/integration tests for cross-workspace scope rejection and retry behavior.

Remaining-gap traceability:

- Confirmed cross-cutting enforcement hardening remains tracked by `bead-0647`.

Re-verified on: 2026-02-21 (ADR-0072 implementation mapping and evidence links remain valid).
