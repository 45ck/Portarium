/**
 * bead-0791: Unit tests for PostgresMachineRegistryStore.
 *
 * Uses an in-memory SqlClient stub to verify SQL queries and row-mapping
 * without a live database connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PostgresMachineRegistryStore } from './postgres-machine-registry-store.js';
import type { SqlClient, SqlQueryResult } from './sql-client.js';
import {
  AgentId,
  CapabilityKey,
  MachineId,
  TenantId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import type { HeartbeatData } from '../../application/ports/machine-registry-store.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSqlClient(): SqlClient {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 } satisfies SqlQueryResult),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as SqlClient;
}

const TENANT = TenantId('tenant-1');
const MACHINE_ID = MachineId('machine-1');
const AGENT_ID = AgentId('agent-1');
const WORKSPACE_ID = WorkspaceId('ws-1');

const MACHINE_REG: MachineRegistrationV1 = {
  schemaVersion: 1,
  machineId: MACHINE_ID,
  workspaceId: WORKSPACE_ID,
  endpointUrl: 'https://machine.example.com',
  active: true,
  displayName: 'Test Machine',
  capabilities: [{ capability: CapabilityKey('robot:navigate') }],
  registeredAtIso: '2025-01-01T00:00:00.000Z',
  executionPolicy: {
    isolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://machine.example.com'],
    workloadIdentity: 'Required',
  },
  authConfig: { kind: 'bearer', secretRef: 'cred-1' },
};

const AGENT_CFG: AgentConfigV1 = {
  schemaVersion: 1,
  agentId: AGENT_ID,
  workspaceId: WORKSPACE_ID,
  machineId: MACHINE_ID,
  displayName: 'Test Agent',
  capabilities: [{ capability: CapabilityKey('robot:navigate') }],
  policyTier: 'HumanApprove',
  allowedTools: [],
  registeredAtIso: '2025-01-01T00:00:00.000Z',
};

const HEARTBEAT: HeartbeatData = {
  status: 'ok',
  lastHeartbeatAtIso: '2025-01-01T00:01:00.000Z',
  metrics: { cpu: 0.5 },
  location: { lat: 51.5, lon: -0.1 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostgresMachineRegistryStore', () => {
  let client: SqlClient;
  let store: PostgresMachineRegistryStore;

  beforeEach(() => {
    client = makeSqlClient();
    store = new PostgresMachineRegistryStore(client);
  });

  // -------------------------------------------------------------------------
  // getMachineRegistrationById
  // -------------------------------------------------------------------------

  describe('getMachineRegistrationById', () => {
    it('returns null when no row found', async () => {
      const result = await store.getMachineRegistrationById(TENANT, MACHINE_ID);
      expect(result).toBeNull();
    });

    it('deserializes the payload when row found', async () => {
      vi.mocked(client.query).mockResolvedValueOnce({
        rows: [{ tenant_id: 'tenant-1', machine_id: 'machine-1', payload: MACHINE_REG }],
        rowCount: 1,
      });
      const result = await store.getMachineRegistrationById(TENANT, MACHINE_ID);
      expect(result).not.toBeNull();
      expect(result?.machineId).toEqual(MACHINE_ID);
      expect(result?.displayName).toBe('Test Machine');
    });

    it('passes correct tenant_id and machine_id to query', async () => {
      await store.getMachineRegistrationById(TENANT, MACHINE_ID);
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('machine_registrations');
      expect(params).toContain('tenant-1');
      expect(params).toContain('machine-1');
    });
  });

  // -------------------------------------------------------------------------
  // saveMachineRegistration
  // -------------------------------------------------------------------------

  describe('saveMachineRegistration', () => {
    it('issues an upsert with correct tenant, machine, workspace, and JSON payload', async () => {
      await store.saveMachineRegistration(TENANT, MACHINE_REG);
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ON CONFLICT');
      expect(params[0]).toBe('tenant-1');
      expect(params[1]).toBe('machine-1');
      expect(params[2]).toBe('ws-1');
      const payload = JSON.parse(params[3] as string) as Record<string, unknown>;
      expect(payload).toMatchObject({ schemaVersion: 1, machineId: 'machine-1' });
    });
  });

  // -------------------------------------------------------------------------
  // getAgentConfigById
  // -------------------------------------------------------------------------

  describe('getAgentConfigById', () => {
    it('returns null when no row found', async () => {
      const result = await store.getAgentConfigById(TENANT, AGENT_ID);
      expect(result).toBeNull();
    });

    it('deserializes the payload when row found', async () => {
      vi.mocked(client.query).mockResolvedValueOnce({
        rows: [{ tenant_id: 'tenant-1', agent_id: 'agent-1', payload: AGENT_CFG }],
        rowCount: 1,
      });
      const result = await store.getAgentConfigById(TENANT, AGENT_ID);
      expect(result?.agentId).toEqual(AGENT_ID);
      expect(result?.displayName).toBe('Test Agent');
    });

    it('passes correct tenant_id and agent_id to query', async () => {
      await store.getAgentConfigById(TENANT, AGENT_ID);
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('agent_configs');
      expect(params).toContain('tenant-1');
      expect(params).toContain('agent-1');
    });
  });

  // -------------------------------------------------------------------------
  // saveAgentConfig
  // -------------------------------------------------------------------------

  describe('saveAgentConfig', () => {
    it('issues an upsert with correct tenant, agent, machine, workspace params', async () => {
      await store.saveAgentConfig(TENANT, AGENT_CFG);
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ON CONFLICT');
      expect(params[0]).toBe('tenant-1');
      expect(params[1]).toBe('agent-1');
      expect(params[2]).toBe('machine-1');
      expect(params[3]).toBe('ws-1');
    });
  });

  // -------------------------------------------------------------------------
  // updateMachineHeartbeat
  // -------------------------------------------------------------------------

  describe('updateMachineHeartbeat', () => {
    it('returns true when a row was updated', async () => {
      vi.mocked(client.query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
      const ok = await store.updateMachineHeartbeat(TENANT, MACHINE_ID, HEARTBEAT);
      expect(ok).toBe(true);
    });

    it('returns false when no matching machine found', async () => {
      const ok = await store.updateMachineHeartbeat(TENANT, MACHINE_ID, HEARTBEAT);
      expect(ok).toBe(false);
    });

    it('passes heartbeat status and timestamp to UPDATE query', async () => {
      vi.mocked(client.query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
      await store.updateMachineHeartbeat(TENANT, MACHINE_ID, HEARTBEAT);
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('UPDATE machine_registrations');
      expect(params).toContain('ok');
      expect(params).toContain('2025-01-01T00:01:00.000Z');
    });

    it('serializes location and metrics as JSON', async () => {
      vi.mocked(client.query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
      await store.updateMachineHeartbeat(TENANT, MACHINE_ID, HEARTBEAT);
      const [, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(params).toContain(JSON.stringify({ cpu: 0.5 }));
      expect(params).toContain(JSON.stringify({ lat: 51.5, lon: -0.1 }));
    });

    it('passes null for absent metrics and location', async () => {
      const bareHeartbeat: HeartbeatData = {
        status: 'degraded',
        lastHeartbeatAtIso: '2025-01-01T00:02:00.000Z',
      };
      vi.mocked(client.query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
      await store.updateMachineHeartbeat(TENANT, MACHINE_ID, bareHeartbeat);
      const [, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(params).toContain(null);
    });
  });

  // -------------------------------------------------------------------------
  // updateAgentHeartbeat
  // -------------------------------------------------------------------------

  describe('updateAgentHeartbeat', () => {
    it('returns true when a row was updated', async () => {
      vi.mocked(client.query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
      const ok = await store.updateAgentHeartbeat(TENANT, AGENT_ID, HEARTBEAT);
      expect(ok).toBe(true);
    });

    it('returns false when no matching agent found', async () => {
      const ok = await store.updateAgentHeartbeat(TENANT, AGENT_ID, HEARTBEAT);
      expect(ok).toBe(false);
    });

    it('passes heartbeat fields to UPDATE query', async () => {
      vi.mocked(client.query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
      await store.updateAgentHeartbeat(TENANT, AGENT_ID, HEARTBEAT);
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('UPDATE agent_configs');
      expect(params).toContain('ok');
      expect(params).toContain('2025-01-01T00:01:00.000Z');
    });
  });
});
