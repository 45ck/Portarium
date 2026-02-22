import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import type { AgentId, MachineId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { Page, PaginationParams } from '../common/query.js';

export type ListMachinesQuery = Readonly<{
  workspaceId: WorkspaceId;
  active?: boolean;
  pagination: PaginationParams;
}>;

export type ListAgentsQuery = Readonly<{
  workspaceId: WorkspaceId;
  machineId?: MachineId;
  pagination: PaginationParams;
}>;

/**
 * Read-model port for machine and agent registry queries.
 *
 * Separate from MachineRegistryStore (the write/command port) to keep
 * read and write sides independently evolvable.
 */
export interface MachineQueryStore {
  getMachineRegistrationById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    machineId: MachineId,
  ): Promise<MachineRegistrationV1 | null>;

  listMachineRegistrations(
    tenantId: TenantId,
    query: ListMachinesQuery,
  ): Promise<Page<MachineRegistrationV1>>;

  getAgentConfigById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    agentId: AgentId,
  ): Promise<AgentConfigV1 | null>;

  listAgentConfigs(tenantId: TenantId, query: ListAgentsQuery): Promise<Page<AgentConfigV1>>;
}
