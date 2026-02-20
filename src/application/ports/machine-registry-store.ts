import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import type { AgentId, MachineId, TenantId } from '../../domain/primitives/index.js';

export type HeartbeatStatus = 'ok' | 'degraded';

export type HeartbeatData = Readonly<{
  status: HeartbeatStatus;
  lastHeartbeatAtIso: string;
  metrics?: Readonly<Record<string, number>>;
  location?: Readonly<{ lat: number; lon: number }>;
}>;

export interface MachineRegistryStore {
  getMachineRegistrationById(
    tenantId: TenantId,
    machineId: MachineId,
  ): Promise<MachineRegistrationV1 | null>;

  saveMachineRegistration(tenantId: TenantId, registration: MachineRegistrationV1): Promise<void>;

  getAgentConfigById(tenantId: TenantId, agentId: AgentId): Promise<AgentConfigV1 | null>;

  saveAgentConfig(tenantId: TenantId, agent: AgentConfigV1): Promise<void>;

  updateMachineHeartbeat(
    tenantId: TenantId,
    machineId: MachineId,
    heartbeat: HeartbeatData,
  ): Promise<boolean>;

  updateAgentHeartbeat(
    tenantId: TenantId,
    agentId: AgentId,
    heartbeat: HeartbeatData,
  ): Promise<boolean>;
}
