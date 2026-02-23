# ADR-0102 — OpenClaw full integration architecture

**Status:** Accepted
**Date:** 2026-02-23
**Bead:** bead-0785
**Related beads:** bead-0784 (campaign), bead-0788, bead-0790, bead-0793, bead-0794, bead-0795, bead-0796, bead-0797, bead-0798, bead-0799, bead-0800, bead-0801
**Related ADRs:** ADR-0098 (schema versioning), ADR-0099 (token browser-exposure prevention)

---

## Context

OpenClaw is a machine-runtime gateway that hosts AI agents on operator-managed
compute. The Portarium control plane needed full end-to-end support for:

1. **Registering machines** — discovering and tracking OpenClaw gateways.
2. **Registering agents** — creating agent configs bound to a specific machine,
   with a human-oversight policy tier.
3. **Displaying machines and agents** — showing live state in the Cockpit UI.
4. **Governed execution** — routing workflow runs through OpenClaw agents under
   the same policy tier and approval gates as any other Portarium agent.
5. **Liveness heartbeats** — keeping machine/agent presence current via
   periodic heartbeats.

Before this campaign, the control plane had stub infrastructure with no
end-to-end wiring; the Cockpit had no machines screen or agent registration
dialog.

---

## Decision

### 1. Domain model — two entity types

The integration introduces two persisted entities (ADR-0098 documents their
schema versioning):

**MachineRegistrationV1** — describes an OpenClaw gateway:

```
machineId       : MachineId (branded)
workspaceId     : WorkspaceId (branded)
endpointUrl     : string (HTTPS URL of the runtime)
displayName     : string
active          : boolean
capabilities    : CapabilityDescriptorV1[]  (non-empty)
executionPolicy :
  isolationMode   : "PerTenantWorker"
  egressAllowlist : string[]  (non-empty HTTPS URLs)
  workloadIdentity: "Required"
authConfig?     : { kind, secretRef? }   (optional; stripped at HTTP boundary)
registeredAtIso : string
```

**AgentConfigV1** — describes an agent bound to a machine:

```
agentId         : AgentId (branded)
workspaceId     : WorkspaceId (branded)
machineId       : MachineId (branded)   ← links agent → machine
displayName     : string
capabilities    : CapabilityDescriptorV1[]  (non-empty)
policyTier      : "Auto" | "Assisted" | "HumanApprove" | "ManualOnly"
allowedTools    : string[]
registeredAtIso : string
```

The `machineId` field on `AgentConfigV1` is the core coupling — it binds an
agent to exactly one machine. The `policyTier` field drives the human-oversight
gate applied to every workflow run that uses this agent (see ADR-0070 for the
hybrid orchestration/choreography contract).

### 2. Architecture layers

The integration spans all four layers:

```
Domain          src/domain/machines/
                  machine-registration-v1.ts   ← parsers + guards
                  machine-events.ts            ← domain events

Application     src/application/commands/
                  machine-agent-registration.ts  ← RegisterMachine, CreateAgent
                  deactivate-machine.ts
                  agent-heartbeat.ts
                src/application/queries/
                  machine-agent-registry.ts      ← getMachine, listMachines,
                                                    getAgent, listAgents,
                                                    listAgentConfigs
                src/application/ports/
                  machine-registry-store.ts
                  machine-query-store.ts
                  openclaw-management-bridge-port.ts

Infrastructure  src/infrastructure/
                  machines/postgres-machine-registry-store.ts
                  machines/postgres-machine-query-store.ts
                  adapters/openclaw-operator-management-bridge.ts
                  adapters/openclaw-ws-client.ts
                  adapters/openclaw-agent-presence-sync.ts

Presentation    src/presentation/runtime/
                  control-plane-handler.machines.ts   ← HTTP handlers
                  control-plane-handler.agents.ts     ← heartbeat handlers
                apps/cockpit/src/
                  hooks/queries/use-machines.ts
                  hooks/queries/use-agents.ts
                  components/cockpit/register-machine-dialog.tsx
                  components/cockpit/register-agent-dialog.tsx
                  components/cockpit/agent-capability-badge.tsx
```

Dependency-cruiser enforces that `src/domain/` has zero imports from
infrastructure or presentation layers.

### 3. HTTP API endpoints

All endpoints are scoped under `/v1/workspaces/{workspaceId}/`:

| Method | Path                              | Handler                  | Roles             |
| ------ | --------------------------------- | ------------------------ | ----------------- |
| GET    | `/machines`                       | `handleListMachines`     | any authenticated |
| POST   | `/machines`                       | `handleRegisterMachine`  | admin, operator   |
| GET    | `/machines/{machineId}`           | `handleGetMachine`       | any authenticated |
| POST   | `/machines/{machineId}/heartbeat` | `handleMachineHeartbeat` | admin, operator   |
| GET    | `/agents`                         | `handleListAgents`       | any authenticated |
| POST   | `/agents`                         | `handleCreateAgent`      | admin, operator   |
| GET    | `/agents/{agentId}`               | `handleGetAgent`         | any authenticated |
| POST   | `/agents/{agentId}/heartbeat`     | `handleAgentHeartbeat`   | admin, operator   |

**Workspace scoping:** Every endpoint calls `assertWorkspaceScope(ctx, wsId)`
before touching any store. A workspace mismatch returns 403 Forbidden, not 404,
to prevent enumeration.

**Credential stripping:** `handleListMachines` and `handleGetMachine` apply
`toMachineApiView()` before serialising, which omits the `authConfig` field
(see ADR-0099).

### 4. Cockpit presentation types

The Cockpit consumes two presentation types from `@portarium/cockpit-types`
(resolves to `src/presentation/ops-cockpit/types.machines.ts`):

```typescript
interface MachineV1 {
  schemaVersion: 1;
  machineId: string;
  workspaceId: string;
  hostname: string;
  osImage?: string;
  registeredAtIso: string;
  lastHeartbeatAtIso?: string;
  status: MachineStatus; // 'Online' | 'Degraded' | 'Offline'
  activeRunCount?: number;
  allowedCapabilities?: AgentCapability[];
}

interface AgentV1 {
  schemaVersion: 1;
  agentId: string;
  workspaceId: string;
  name: string;
  modelId?: string;
  endpoint: string;
  allowedCapabilities: AgentCapability[];
  usedByWorkflowIds?: string[];
  machineId?: string; // OpenClaw: machine this agent runs on
  policyTier?: PolicyTier; // 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly'
}
```

`AgentCapability` includes `'machine:invoke'` — the sentinel that marks an
agent as OpenClaw-native.

### 5. Policy tier and human-oversight gate

The `policyTier` on `AgentConfigV1` maps directly to the `PolicyTier` type on
`AgentV1`. The values align with ADR-0070's hybrid orchestration contract:

| Tier           | Human gate applied                            |
| -------------- | --------------------------------------------- |
| `Auto`         | None — run proceeds autonomously              |
| `Assisted`     | Advisory alert; operator can intervene        |
| `HumanApprove` | Step blocked until explicit operator approval |
| `ManualOnly`   | Every tool call requires manual confirmation  |

The `policyTier` is stored in `AgentConfigV1.policyTier` and surfaced to the
Cockpit via `AgentV1.policyTier`. It is validated at agent-creation time by
`parseAgentConfigV1`; there is no default — callers must supply the tier
explicitly.

### 6. Agent–machine binding invariants

The domain enforces these invariants at parse time:

- `AgentConfigV1.machineId` is required (no null/undefined).
- `AgentConfigV1.capabilities` must have at least one entry.
- `AgentConfigV1.policyTier` must be a valid `PolicyTier` value.
- `MachineRegistrationV1.executionPolicy.egressAllowlist` must have at least
  one HTTPS URL.
- When `MachineRegistrationV1.active` is `true`, `authConfig` must be present
  (`guardActiveMachineAuth` enforces this).

These invariants are checked in `parseMachineRegistrationV1` and
`parseAgentConfigV1` in `src/domain/machines/machine-registration-v1.ts`.

### 7. Liveness heartbeat protocol

Machine and agent heartbeats use identical HTTP semantics:

```
POST /v1/workspaces/{wsId}/machines/{machineId}/heartbeat
POST /v1/workspaces/{wsId}/agents/{agentId}/heartbeat
```

Both endpoints:

1. Authenticate the caller.
2. Assert workspace scope.
3. Look up the entity in the store.
4. Update `lastHeartbeatAtIso` + `status`.
5. Publish a `MachineHeartbeatReceived` or `AgentHeartbeatReceived` domain
   event for downstream presence/drift monitoring.

The heartbeat interval is defined by the machine operator and is not enforced
by the control plane. Presence inference (Online / Degraded / Offline) uses
the `lastHeartbeatAtIso` timestamp against a configurable staleness window.

### 8. Gateway sync (WebSocket management bridge)

`OpenClawOperatorManagementBridge` (`openclaw-operator-management-bridge.ts`)
maintains a persistent WebSocket connection to each active machine's management
endpoint. It:

- Discovers machines via the `machine-registry-store`.
- Pushes `SyncAgentToGateway` commands when agent configs change.
- Receives drift notifications and publishes `AgentCapabilityDriftDetected`
  domain events.
- Holds the gateway API token in a `readonly #apiToken` private field; the
  token is never persisted or included in HTTP responses (ADR-0099).

### 9. Cockpit wiring and MSW isolation

The Cockpit uses TanStack Query hooks (`useMachines`, `useAgents`,
`useMachine`, `useAgent`) that fetch from the live control-plane API. During
tests and local development, MSW handlers intercept these requests and return
fixture data from `apps/cockpit/src/mocks/fixtures/demo.ts`.

`RegisterMachineDialog` and `RegisterAgentDialog` are modal components that
POST to the respective creation endpoints and invalidate the relevant query
cache on success.

### 10. Contract test coverage

`control-plane-handler.machine-agent.contract.test.ts` contains HTTP-level
integration tests that cover:

- Machine CRUD: register, list (filtered/unfiltered), get, delete.
- Agent CRUD: create (with `machineId` + `policyTier`), list (with `?machineId`
  filter), get (verifying `machineId` and `policyTier` round-trip), delete.
- `authConfig` stripping: GET and LIST machine responses must not contain
  `authConfig`.
- Workspace isolation: agents with a mismatched `workspaceId` in the body
  receive 403.
- Role gate: `auditor` role cannot register machines or create agents (403).
- Heartbeat liveness: machine + agent heartbeat endpoints accept valid tokens
  and update presence.
- OpenClaw full lifecycle: register machine → register agent → display agent
  with `machineId`+`policyTier` → heartbeat.

These tests act as regression guards for all the invariants described above.

---

## Consequences

### Positive

- End-to-end lifecycle (create → connect → display → run) is wired and
  contract-tested at the HTTP boundary.
- `machineId` and `policyTier` on agents provide the Cockpit with all
  information needed to display the gateway relationship and oversight level
  without additional API calls.
- Credential references (`authConfig.secretRef`) never reach the browser;
  enforced at the handler layer and verified by contract tests.
- The `policyTier` field aligns with the existing hybrid orchestration contract
  (ADR-0070), so no new approval-gate logic is needed.
- MSW isolation means Cockpit tests are hermetic and do not require a running
  control plane.

### Negative / trade-offs

- `machineId` is required on every `AgentConfigV1`. Agents that pre-date the
  OpenClaw integration may not have a `machineId`; those agents must either
  be re-registered or a data migration must back-fill a sentinel value.
- The gateway WebSocket bridge introduces a long-lived outbound connection per
  active machine. Operators must ensure the control plane has network access
  to each machine's management endpoint.
- `policyTier` has no default; callers must supply it. This is intentional
  (fail-safe) but increases the burden on integration clients that migrate
  from the pre-campaign API.

### Neutral

- The two-entity model (machine + agent) mirrors the OpenClaw operator model
  naturally. No domain compromise was needed.
- Schema versioning follows ADR-0098's expand/contract pattern; no v2 bump
  is triggered by this campaign.
- The heartbeat protocol is stateless from the control plane's perspective;
  presence state is derived, not stored as a boolean flag.
