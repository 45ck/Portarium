/**
 * bead-0791: PostgreSQL adapter for MachineRegistryStore + MachineQueryStore.
 *
 * Persists machine registrations, agent configs, and live heartbeat data to
 * dedicated tables (added in migrations 0013 and 0014).
 *
 * Heartbeat columns are kept on the machine/agent row to avoid extra JOIN
 * latency on the hot-path health-check read. `updateMachineHeartbeat` /
 * `updateAgentHeartbeat` return `false` when no row is found (machine/agent
 * not yet registered), so callers can distinguish "heartbeat rejected" from
 * an update error.
 */

import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import {
  parseMachineRegistrationV1,
  parseAgentConfigV1,
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
import { clampLimit } from '../../application/common/query.js';
import type { SqlClient } from './sql-client.js';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface MachineRegistrationRow extends Record<string, unknown> {
  tenant_id: string;
  machine_id: string;
  payload: unknown;
}

interface AgentConfigRow extends Record<string, unknown> {
  tenant_id: string;
  agent_id: string;
  payload: unknown;
}

// ---------------------------------------------------------------------------
// PostgresMachineRegistryStore
// ---------------------------------------------------------------------------

export class PostgresMachineRegistryStore implements MachineRegistryStore, MachineQueryStore {
  readonly #client: SqlClient;

  public constructor(client: SqlClient) {
    this.#client = client;
  }

  // -------------------------------------------------------------------------
  // Machine registration — overloaded to satisfy both interfaces
  // -------------------------------------------------------------------------

  public async getMachineRegistrationById(
    tenantId: TenantId,
    machineId: MachineId,
  ): Promise<MachineRegistrationV1 | null>;
  public async getMachineRegistrationById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    machineId: MachineId,
  ): Promise<MachineRegistrationV1 | null>;
  public async getMachineRegistrationById(
    tenantId: TenantId,
    machineIdOrWorkspaceId: MachineId | WorkspaceId,
    maybeMachineId?: MachineId,
  ): Promise<MachineRegistrationV1 | null> {
    const machineId = maybeMachineId ?? (machineIdOrWorkspaceId as MachineId);
    const result = await this.#client.query<MachineRegistrationRow>(
      `SELECT tenant_id, machine_id, payload
         FROM machine_registrations
        WHERE tenant_id = $1 AND machine_id = $2
        LIMIT 1`,
      [String(tenantId), String(machineId)],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return parseMachineRegistrationV1(row.payload);
  }

  public async saveMachineRegistration(
    tenantId: TenantId,
    registration: MachineRegistrationV1,
  ): Promise<void> {
    await this.#client.query(
      `INSERT INTO machine_registrations (tenant_id, machine_id, workspace_id, payload, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (tenant_id, machine_id)
       DO UPDATE SET
         workspace_id = EXCLUDED.workspace_id,
         payload      = EXCLUDED.payload,
         updated_at   = NOW()`,
      [
        String(tenantId),
        String(registration.machineId),
        String(registration.workspaceId),
        JSON.stringify(registration),
      ],
    );
  }

  // -------------------------------------------------------------------------
  // Agent configuration — overloaded to satisfy both interfaces
  // -------------------------------------------------------------------------

  public async getAgentConfigById(
    tenantId: TenantId,
    agentId: AgentId,
  ): Promise<AgentConfigV1 | null>;
  public async getAgentConfigById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    agentId: AgentId,
  ): Promise<AgentConfigV1 | null>;
  public async getAgentConfigById(
    tenantId: TenantId,
    agentIdOrWorkspaceId: AgentId | WorkspaceId,
    maybeAgentId?: AgentId,
  ): Promise<AgentConfigV1 | null> {
    const agentId = maybeAgentId ?? (agentIdOrWorkspaceId as AgentId);
    const result = await this.#client.query<AgentConfigRow>(
      `SELECT tenant_id, agent_id, payload
         FROM agent_configs
        WHERE tenant_id = $1 AND agent_id = $2
        LIMIT 1`,
      [String(tenantId), String(agentId)],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return parseAgentConfigV1(row.payload);
  }

  public async saveAgentConfig(tenantId: TenantId, agent: AgentConfigV1): Promise<void> {
    await this.#client.query(
      `INSERT INTO agent_configs
         (tenant_id, agent_id, machine_id, workspace_id, payload, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (tenant_id, agent_id)
       DO UPDATE SET
         machine_id   = EXCLUDED.machine_id,
         workspace_id = EXCLUDED.workspace_id,
         payload      = EXCLUDED.payload,
         updated_at   = NOW()`,
      [
        String(tenantId),
        String(agent.agentId),
        String(agent.machineId),
        String(agent.workspaceId),
        JSON.stringify(agent),
      ],
    );
  }

  // -------------------------------------------------------------------------
  // Heartbeats
  // -------------------------------------------------------------------------

  public async updateMachineHeartbeat(
    tenantId: TenantId,
    machineId: MachineId,
    heartbeat: HeartbeatData,
  ): Promise<boolean> {
    const result = await this.#client.query<Record<string, unknown>>(
      `UPDATE machine_registrations
          SET heartbeat_status   = $3,
              heartbeat_at       = $4,
              heartbeat_metrics  = $5::jsonb,
              heartbeat_location = $6::jsonb,
              updated_at         = NOW()
        WHERE tenant_id = $1 AND machine_id = $2`,
      [
        String(tenantId),
        String(machineId),
        heartbeat.status,
        heartbeat.lastHeartbeatAtIso,
        heartbeat.metrics !== undefined ? JSON.stringify(heartbeat.metrics) : null,
        heartbeat.location !== undefined ? JSON.stringify(heartbeat.location) : null,
      ],
    );
    return (result.rowCount ?? 0) > 0;
  }

  public async updateAgentHeartbeat(
    tenantId: TenantId,
    agentId: AgentId,
    heartbeat: HeartbeatData,
  ): Promise<boolean> {
    const result = await this.#client.query<Record<string, unknown>>(
      `UPDATE agent_configs
          SET heartbeat_status = $3,
              heartbeat_at     = $4,
              updated_at       = NOW()
        WHERE tenant_id = $1 AND agent_id = $2`,
      [String(tenantId), String(agentId), heartbeat.status, heartbeat.lastHeartbeatAtIso],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // MachineQueryStore — list methods
  // -------------------------------------------------------------------------

  public async listMachineRegistrations(
    tenantId: TenantId,
    query: ListMachinesQuery,
  ): Promise<Page<MachineRegistrationV1>> {
    const limit = clampLimit(query.pagination.limit);
    const fetchLimit = limit + 1;
    const params: unknown[] = [String(tenantId), String(query.workspaceId)];

    let sql = `SELECT payload FROM machine_registrations
      WHERE tenant_id = $1 AND workspace_id = $2`;

    if (query.active !== undefined) {
      params.push(query.active);
      sql += ` AND (payload->>'active')::boolean = $${params.length}`;
    }
    if (query.pagination.cursor) {
      params.push(String(query.pagination.cursor));
      sql += ` AND machine_id > $${params.length}`;
    }

    params.push(fetchLimit);
    sql += ` ORDER BY machine_id ASC LIMIT $${params.length}`;

    const result = await this.#client.query<{ payload: unknown }>(sql, params);
    const rows = result.rows.map((r) => parseMachineRegistrationV1(r.payload));
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const page: Page<MachineRegistrationV1> = { items };
    if (hasMore && items.length > 0) {
      (page as { nextCursor?: string }).nextCursor = String(items[items.length - 1]!.machineId);
    }
    return page;
  }

  public async listAgentConfigs(
    tenantId: TenantId,
    query: ListAgentsQuery,
  ): Promise<Page<AgentConfigV1>> {
    const limit = clampLimit(query.pagination.limit);
    const fetchLimit = limit + 1;
    const params: unknown[] = [String(tenantId), String(query.workspaceId)];

    let sql = `SELECT payload FROM agent_configs
      WHERE tenant_id = $1 AND workspace_id = $2`;

    if (query.machineId) {
      params.push(String(query.machineId));
      sql += ` AND machine_id = $${params.length}`;
    }
    if (query.pagination.cursor) {
      params.push(String(query.pagination.cursor));
      sql += ` AND agent_id > $${params.length}`;
    }

    params.push(fetchLimit);
    sql += ` ORDER BY agent_id ASC LIMIT $${params.length}`;

    const result = await this.#client.query<{ payload: unknown }>(sql, params);
    const rows = result.rows.map((r) => parseAgentConfigV1(r.payload));
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const page: Page<AgentConfigV1> = { items };
    if (hasMore && items.length > 0) {
      (page as { nextCursor?: string }).nextCursor = String(items[items.length - 1]!.agentId);
    }
    return page;
  }
}
