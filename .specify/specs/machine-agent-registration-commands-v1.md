# Machine Agent Registration Commands v1

**Beads:** bead-0434, bead-0655, bead-0656, bead-0657

## Purpose

Define application command handlers for machine/agent registration lifecycle with tenancy enforcement, idempotency safety, and evidence logging.

## Commands

- `RegisterMachine`
  - Input: `idempotencyKey`, machine payload (`MachineRegistrationV1`).
  - Validates machine schema and tenant workspace match.
  - Rejects duplicate `machineId`.

- `CreateAgent`
  - Input: `idempotencyKey`, agent payload (`AgentConfigV1`).
  - Validates agent schema and tenant workspace match.
  - Requires non-empty `capabilities[]` declared as canonical `entity:verb` tokens.
  - Requires referenced machine registration to exist.
  - Enforces capability handshake: every declared agent capability must be declared by the
    target machine registration.
  - For re-registration with an existing `agentId`, evaluate capability drift against the
    previously registered capability set.
    - If drift is detected and not reviewed, the agent is quarantined and the command is denied.
  - Rejects duplicate `agentId`.

- `UpdateAgentCapabilities`
  - Input: `idempotencyKey`, `workspaceId`, `agentId`, `allowedTools[]`.
  - Enforces workspace scope and existing agent.
  - Re-validates policy tier vs tool blast radius constraints via `parseAgentConfigV1`.

## Authorization and Tenancy

- All commands require `AuthorizationPort.isAllowed(..., APP_ACTIONS.workspaceRegister)`.
- Command payload workspace must equal `AppContext.tenantId`; cross-tenant requests return `Forbidden`.

## Idempotency

- Each command persists output under:
  - `{ tenantId, commandName, requestKey }`.
- Repeated requests with same key return cached output without duplicate writes/evidence.

## Capability Handshake and Routing

- Domain type `CapabilityDescriptor` (`src/domain/machines/capability-handshake-v1.ts`) defines
  the canonical capability declaration object and uses branded primitive `CapabilityKey`.
- Machine and agent registrations persist capability descriptors.
- Handshake model derives:
  - `routableCapabilities`: intersection of machine and agent declarations.
  - `nonRoutableAgentCapabilities`: declared by agent but absent on machine.
- Agent registration fails with `ValidationFailed` when any non-routable capabilities are
  declared.
- Routing checks use `routeCapabilityToAgentV1`:
  - Route only when capability is declared by both machine and agent.
  - Deny with explicit reason when declaration is missing on either side.

## Capability Drift Quarantine Policy

- Domain rule (`evaluateCapabilityDriftQuarantinePolicyV1`) compares baseline vs observed
  capabilities for heartbeat or re-registration observations.
- Drift includes:
  - `addedCapabilities` (newly declared),
  - `removedCapabilities` (no longer declared).
- Policy decisions:
  - `Allow` when no drift exists,
  - `Quarantine` with run-state mapping `PolicyBlocked` when unreviewed drift is detected,
  - `Allow` when drift is explicitly reviewed.
- In application command flow, re-registration drift triggers quarantine and denies side effects.

## Evidence Emission

- Every successful command appends one evidence entry (`category: Action`) through `EvidenceLogPort`.
- Evidence entry includes workspace, correlation, actor, timestamp, and operation summary.

## Test Expectations

Unit tests must verify:

- happy-path persistence + evidence append for each command,
- tenant mismatch rejection,
- duplicate idempotency key short-circuit behavior,
- missing machine/agent not-found behavior,
- capability handshake mismatch rejection when agent declares machine-unsupported capabilities,
- capability drift quarantine behavior on re-registration,
- invalid capability updates rejected by policy-tier validation.
