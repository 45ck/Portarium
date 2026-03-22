/**
 * In-memory implementation of MachineRegistryStore and MachineQueryStore
 * for local development and testing (DEV_STUB_STORES mode).
 */

import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import type { AgentId, MachineId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type {
  MachineRegistryStore,
  HeartbeatData,
} from '../../application/ports/machine-registry-store.js';
import type {
  MachineQueryStore,
  ListMachinesQuery,
  ListAgentsQuery,
} from '../../application/ports/machine-query-store.js';
import type { Page } from '../../application/common/query.js';

export class InMemoryMachineRegistryStore implements MachineRegistryStore, MachineQueryStore {
  readonly #machines = new Map<string, MachineRegistrationV1>();
  readonly #agents = new Map<string, AgentConfigV1>();

  // -- key helpers --
  #machineKey(tenantId: TenantId, machineId: MachineId): string {
    return `${String(tenantId)}::${String(machineId)}`;
  }
  #agentKey(tenantId: TenantId, agentId: AgentId): string {
    return `${String(tenantId)}::${String(agentId)}`;
  }

  // -- getMachineRegistrationById: overloaded to satisfy both interfaces --

  async getMachineRegistrationById(
    tenantId: TenantId,
    machineId: MachineId,
  ): Promise<MachineRegistrationV1 | null>;
  async getMachineRegistrationById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    machineId: MachineId,
  ): Promise<MachineRegistrationV1 | null>;
  async getMachineRegistrationById(
    tenantId: TenantId,
    machineIdOrWorkspaceId: MachineId | WorkspaceId,
    maybeMachineId?: MachineId,
  ): Promise<MachineRegistrationV1 | null> {
    const machineId = maybeMachineId ?? (machineIdOrWorkspaceId as MachineId);
    return this.#machines.get(this.#machineKey(tenantId, machineId)) ?? null;
  }

  async saveMachineRegistration(
    tenantId: TenantId,
    registration: MachineRegistrationV1,
  ): Promise<void> {
    this.#machines.set(
      this.#machineKey(tenantId, registration.machineId as unknown as MachineId),
      registration,
    );
  }

  // -- getAgentConfigById: overloaded to satisfy both interfaces --

  async getAgentConfigById(tenantId: TenantId, agentId: AgentId): Promise<AgentConfigV1 | null>;
  async getAgentConfigById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    agentId: AgentId,
  ): Promise<AgentConfigV1 | null>;
  async getAgentConfigById(
    tenantId: TenantId,
    agentIdOrWorkspaceId: AgentId | WorkspaceId,
    maybeAgentId?: AgentId,
  ): Promise<AgentConfigV1 | null> {
    const agentId = maybeAgentId ?? (agentIdOrWorkspaceId as AgentId);
    return this.#agents.get(this.#agentKey(tenantId, agentId)) ?? null;
  }

  async saveAgentConfig(tenantId: TenantId, agent: AgentConfigV1): Promise<void> {
    this.#agents.set(this.#agentKey(tenantId, agent.agentId as unknown as AgentId), agent);
  }

  async updateMachineHeartbeat(
    tenantId: TenantId,
    machineId: MachineId,
    _heartbeat: HeartbeatData,
  ): Promise<boolean> {
    return this.#machines.has(this.#machineKey(tenantId, machineId));
  }

  async updateAgentHeartbeat(
    tenantId: TenantId,
    agentId: AgentId,
    _heartbeat: HeartbeatData,
  ): Promise<boolean> {
    return this.#agents.has(this.#agentKey(tenantId, agentId));
  }

  // -- MachineQueryStore (read) --

  async listMachineRegistrations(
    _tenantId: TenantId,
    query: ListMachinesQuery,
  ): Promise<Page<MachineRegistrationV1>> {
    const wsId = String(query.workspaceId);
    let items = [...this.#machines.values()].filter((m) => String(m.workspaceId) === wsId);
    if (query.active !== undefined) {
      items = items.filter((m) => m.active === query.active);
    }
    const limit = query.pagination.limit ?? 50;
    return { items: items.slice(0, limit) };
  }

  async listAgentConfigs(
    _tenantId: TenantId,
    query: ListAgentsQuery,
  ): Promise<Page<AgentConfigV1>> {
    const wsId = String(query.workspaceId);
    let items = [...this.#agents.values()].filter((a) => String(a.workspaceId) === wsId);
    if (query.machineId) {
      items = items.filter((a) => String(a.machineId) === String(query.machineId));
    }
    const limit = query.pagination.limit ?? 50;
    return { items: items.slice(0, limit) };
  }
}
