import { describe, expect, it } from 'vitest';

import type { SqlClient } from './sql-client.js';
import { PostgresReadModelProjector } from './postgres-read-model-projector.js';

// ---------------------------------------------------------------------------
// Mock SqlClient
// ---------------------------------------------------------------------------

class MockSqlClient implements SqlClient {
  readonly calls: { sql: string; params: unknown[] }[] = [];

  query<T extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: readonly T[]; rowCount: number }> {
    this.calls.push({ sql, params: [...params] });
    return Promise.resolve({ rows: [], rowCount: 0 });
  }
}

describe('PostgresReadModelProjector', () => {
  describe('upsertRun', () => {
    it('executes INSERT ... ON CONFLICT for workflow_runs', async () => {
      const client = new MockSqlClient();
      const projector = new PostgresReadModelProjector(client);

      await projector.upsertRun({
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        runId: 'run-1',
        workflowId: 'wf-1',
        status: 'Running',
        initiatedByUserId: 'user-1',
        createdAtIso: '2024-01-01T00:00:00Z',
        startedAtIso: '2024-01-01T00:00:01Z',
        eventSeq: 42,
      });

      expect(client.calls).toHaveLength(1);
      const { sql, params } = client.calls[0]!;
      expect(sql).toContain('INSERT INTO workflow_runs');
      expect(sql).toContain('ON CONFLICT (tenant_id, run_id)');
      expect(sql).toContain('WHERE EXCLUDED.event_seq > workflow_runs.event_seq');
      expect(params[0]).toBe('tenant-1');
      expect(params[1]).toBe('run-1');
      expect(params[4]).toBe('Running');
      expect(params[9]).toBe(42);
    });

    it('passes null for optional fields when not provided', async () => {
      const client = new MockSqlClient();
      const projector = new PostgresReadModelProjector(client);

      await projector.upsertRun({
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        runId: 'run-2',
        workflowId: 'wf-1',
        status: 'Pending',
        createdAtIso: '2024-01-01T00:00:00Z',
        eventSeq: 1,
      });

      const { params } = client.calls[0]!;
      expect(params[5]).toBeNull(); // initiatedByUserId
      expect(params[7]).toBeNull(); // startedAtIso
      expect(params[8]).toBeNull(); // endedAtIso
    });

    it('uses event_seq guard so stale events do not overwrite newer state', async () => {
      const client = new MockSqlClient();
      const projector = new PostgresReadModelProjector(client);

      // Both upserts go through — the DB enforces the WHERE clause guard;
      // from the projector perspective both calls produce the correct SQL.
      await projector.upsertRun({
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        runId: 'run-3',
        workflowId: 'wf-1',
        status: 'Succeeded',
        createdAtIso: '2024-01-01T00:00:00Z',
        eventSeq: 100,
      });

      await projector.upsertRun({
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        runId: 'run-3',
        workflowId: 'wf-1',
        status: 'Running',
        createdAtIso: '2024-01-01T00:00:00Z',
        eventSeq: 5, // lower seq — DB will reject via WHERE guard
      });

      // Both calls produce correct SQL; the WHERE guard is enforced by PostgreSQL
      expect(client.calls).toHaveLength(2);
      expect(client.calls[0]!.params[9]).toBe(100);
      expect(client.calls[1]!.params[9]).toBe(5);
    });
  });

  describe('upsertWorkspace', () => {
    it('executes INSERT ... ON CONFLICT for workspace_summary', async () => {
      const client = new MockSqlClient();
      const projector = new PostgresReadModelProjector(client);

      await projector.upsertWorkspace({
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        name: 'My Workspace',
        status: 'Active',
        createdAtIso: '2024-01-01T00:00:00Z',
        eventSeq: 10,
      });

      expect(client.calls).toHaveLength(1);
      const { sql, params } = client.calls[0]!;
      expect(sql).toContain('INSERT INTO workspace_summary');
      expect(sql).toContain('ON CONFLICT (tenant_id, workspace_id)');
      expect(sql).toContain('WHERE EXCLUDED.event_seq > workspace_summary.event_seq');
      expect(params[0]).toBe('tenant-1');
      expect(params[1]).toBe('ws-1');
      expect(params[2]).toBe('My Workspace');
      expect(params[3]).toBe('Active');
      expect(params[5]).toBe(10);
    });

    it('uses event_seq guard for idempotency', async () => {
      const client = new MockSqlClient();
      const projector = new PostgresReadModelProjector(client);

      await projector.upsertWorkspace({
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        name: 'Updated Name',
        status: 'Active',
        createdAtIso: '2024-01-01T00:00:00Z',
        eventSeq: 50,
      });

      await projector.upsertWorkspace({
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        name: 'Old Name',
        status: 'Active',
        createdAtIso: '2024-01-01T00:00:00Z',
        eventSeq: 3, // stale — DB WHERE guard prevents overwrite
      });

      expect(client.calls).toHaveLength(2);
      expect(client.calls[0]!.params[5]).toBe(50);
      expect(client.calls[1]!.params[5]).toBe(3);
    });
  });
});
