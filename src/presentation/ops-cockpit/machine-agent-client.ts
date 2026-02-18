import { ControlPlaneClient } from './http-client.js';
import { buildCursorQuery } from './pagination.js';
import type {
  AgentV1,
  ConnectionTestResult,
  CursorPage,
  ListAgentsRequest,
  ListMachinesRequest,
  MachineV1,
  RegisterAgentRequest,
  RegisterMachineRequest,
  UpdateAgentRequest,
} from './types.js';

function normalizeWorkspaceId(id: string): string {
  return encodeURIComponent(id);
}

function normalizeResourceId(id: string): string {
  return encodeURIComponent(id);
}

/**
 * Extends ControlPlaneClient with machine runtime and AI agent endpoints.
 *
 * Machines: bead-0438 — GET/POST /v1/workspaces/{ws}/machines, DELETE /machines/{id}, POST /machines/{id}/test
 * Agents:   bead-0439 — GET/POST /v1/workspaces/{ws}/agents, PATCH /agents/{id}, POST /agents/{id}/test
 */
export class MachineAgentClient extends ControlPlaneClient {
  // ---------------------------------------------------------------------------
  // Machine runtime registry (bead-0438)
  // ---------------------------------------------------------------------------

  public async listMachines(
    workspaceId: string,
    request: ListMachinesRequest = {},
  ): Promise<CursorPage<MachineV1>> {
    const query = this.buildCursorQuery(request);
    return this.request<CursorPage<MachineV1>>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/machines`,
      'GET',
      { query },
    );
  }

  public async registerMachine(
    workspaceId: string,
    req: RegisterMachineRequest,
    idempotencyKey?: string,
  ): Promise<MachineV1> {
    return this.request<MachineV1>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/machines`,
      'POST',
      { body: req, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
  }

  public async getMachine(workspaceId: string, machineId: string): Promise<MachineV1> {
    return this.request<MachineV1>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/machines/${normalizeResourceId(machineId)}`,
      'GET',
    );
  }

  public async deregisterMachine(workspaceId: string, machineId: string): Promise<void> {
    return this.request<void>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/machines/${normalizeResourceId(machineId)}`,
      'DELETE',
    );
  }

  public async testMachineConnection(
    workspaceId: string,
    machineId: string,
  ): Promise<ConnectionTestResult> {
    return this.request<ConnectionTestResult>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/machines/${normalizeResourceId(machineId)}/test`,
      'POST',
    );
  }

  // ---------------------------------------------------------------------------
  // AI agent configuration (bead-0439)
  // ---------------------------------------------------------------------------

  public async listAgents(
    workspaceId: string,
    request: ListAgentsRequest = {},
  ): Promise<CursorPage<AgentV1>> {
    const query = buildCursorQuery(request).query;
    return this.request<CursorPage<AgentV1>>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/agents`,
      'GET',
      { query },
    );
  }

  public async registerAgent(
    workspaceId: string,
    req: RegisterAgentRequest,
    idempotencyKey?: string,
  ): Promise<AgentV1> {
    return this.request<AgentV1>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/agents`,
      'POST',
      { body: req, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
  }

  public async getAgent(workspaceId: string, agentId: string): Promise<AgentV1> {
    return this.request<AgentV1>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/agents/${normalizeResourceId(agentId)}`,
      'GET',
    );
  }

  public async updateAgent(
    workspaceId: string,
    agentId: string,
    req: UpdateAgentRequest,
  ): Promise<AgentV1> {
    return this.request<AgentV1>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/agents/${normalizeResourceId(agentId)}`,
      'PATCH',
      { body: req },
    );
  }

  public async testAgentConnection(
    workspaceId: string,
    agentId: string,
  ): Promise<ConnectionTestResult> {
    return this.request<ConnectionTestResult>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/agents/${normalizeResourceId(agentId)}/test`,
      'POST',
    );
  }
}
