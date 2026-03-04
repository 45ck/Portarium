/**
 * bead-0877: Unit tests for PostgresAgentActionProposalStore.
 *
 * Uses a stub SqlClient to verify SQL queries and row-mapping
 * without a live database connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PostgresAgentActionProposalStore } from './postgres-agent-action-proposal-store.js';
import type { SqlClient, SqlQueryResult } from './sql-client.js';
import {
  AgentId,
  CorrelationId,
  PolicyId,
  ProposalId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { AgentActionProposalV1 } from '../../domain/machines/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSqlClient(): SqlClient {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 } satisfies SqlQueryResult),
    withTransaction: vi.fn().mockImplementation(async <T>(fn: (tx: SqlClient) => Promise<T>) => {
      return fn(makeSqlClient());
    }),
  } as unknown as SqlClient;
}

const TENANT = TenantId('t-1');
const WORKSPACE = WorkspaceId('ws-1');

function makeProposal(overrides?: Partial<AgentActionProposalV1>): AgentActionProposalV1 {
  return {
    schemaVersion: 1,
    proposalId: ProposalId('prop-1'),
    workspaceId: WorkspaceId('ws-1'),
    agentId: AgentId('agent-1'),
    actionKind: 'invoke-tool',
    toolName: 'list-files',
    executionTier: 'Auto',
    toolClassification: {
      toolName: 'list-files',
      category: 'ReadOnly',
      minimumTier: 'Auto',
      rationale: 'Read-only tool.',
    },
    policyDecision: 'Allow',
    policyIds: [PolicyId('pol-1')],
    decision: 'Allow',
    rationale: 'Routine read-only query.',
    requestedByUserId: UserId('user-1'),
    correlationId: CorrelationId('corr-1'),
    proposedAtIso: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostgresAgentActionProposalStore', () => {
  let client: SqlClient;
  let store: PostgresAgentActionProposalStore;

  beforeEach(() => {
    client = makeSqlClient();
    store = new PostgresAgentActionProposalStore(client);
  });

  // -------------------------------------------------------------------------
  // getProposalById
  // -------------------------------------------------------------------------

  describe('getProposalById', () => {
    it('returns null for unknown proposalId', async () => {
      const result = await store.getProposalById(TENANT, ProposalId('nonexistent'));
      expect(result).toBeNull();
    });

    it('deserializes the payload when row found', async () => {
      const proposal = makeProposal();
      vi.mocked(client.query).mockResolvedValueOnce({
        rows: [
          {
            tenant_id: 't-1',
            proposal_id: 'prop-1',
            workspace_id: 'ws-1',
            payload: proposal,
          },
        ],
        rowCount: 1,
      });
      const result = await store.getProposalById(TENANT, ProposalId('prop-1'));
      expect(result).not.toBeNull();
      expect(result?.proposalId).toEqual(ProposalId('prop-1'));
      expect(result?.decision).toBe('Allow');
    });

    it('passes correct tenant_id and proposal_id to query', async () => {
      await store.getProposalById(TENANT, ProposalId('prop-1'));
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('agent_action_proposals');
      expect(params).toContain('t-1');
      expect(params).toContain('prop-1');
    });
  });

  // -------------------------------------------------------------------------
  // saveProposal
  // -------------------------------------------------------------------------

  describe('saveProposal', () => {
    it('issues an upsert with correct tenant, proposal, workspace, and JSON payload', async () => {
      const proposal = makeProposal();
      await store.saveProposal(TENANT, proposal);
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE SET');
      expect(params[0]).toBe('t-1');
      expect(params[1]).toBe('prop-1');
      expect(params[2]).toBe('ws-1');
      const payload = JSON.parse(params[3] as string) as Record<string, unknown>;
      expect(payload).toMatchObject({ schemaVersion: 1, proposalId: 'prop-1' });
    });

    it('passes null for idempotencyKey when not set', async () => {
      const proposal = makeProposal();
      await store.saveProposal(TENANT, proposal);
      const [, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(params[4]).toBeNull();
    });

    it('passes idempotencyKey when set', async () => {
      const proposal = makeProposal({ idempotencyKey: 'idem-key-1' });
      await store.saveProposal(TENANT, proposal);
      const [, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(params[4]).toBe('idem-key-1');
    });

    it('handles idempotent upsert (ON CONFLICT)', async () => {
      const original = makeProposal();
      const updated = makeProposal({ decision: 'NeedsApproval' });

      await store.saveProposal(TENANT, original);
      await store.saveProposal(TENANT, updated);

      // Both calls should use ON CONFLICT syntax
      const calls = vi.mocked(client.query).mock.calls;
      expect(calls).toHaveLength(2);
      expect((calls[0] as [string])[0]).toContain('ON CONFLICT');
      expect((calls[1] as [string])[0]).toContain('ON CONFLICT');

      // Second call should contain the updated payload
      const secondPayload = JSON.parse((calls[1] as [string, unknown[]])[1][3] as string) as Record<string, unknown>;
      expect(secondPayload).toMatchObject({ decision: 'NeedsApproval' });
    });
  });

  // -------------------------------------------------------------------------
  // getProposalByIdempotencyKey
  // -------------------------------------------------------------------------

  describe('getProposalByIdempotencyKey', () => {
    it('returns null for unknown idempotencyKey', async () => {
      const result = await store.getProposalByIdempotencyKey(
        TENANT,
        WORKSPACE,
        'nonexistent-key',
      );
      expect(result).toBeNull();
    });

    it('finds proposal by idempotencyKey', async () => {
      const proposal = makeProposal({ idempotencyKey: 'idem-key-1' });
      vi.mocked(client.query).mockResolvedValueOnce({
        rows: [
          {
            tenant_id: 't-1',
            proposal_id: 'prop-1',
            workspace_id: 'ws-1',
            payload: proposal,
          },
        ],
        rowCount: 1,
      });
      const result = await store.getProposalByIdempotencyKey(
        TENANT,
        WORKSPACE,
        'idem-key-1',
      );
      expect(result).not.toBeNull();
      expect(result?.proposalId).toEqual(ProposalId('prop-1'));
    });

    it('passes correct tenant_id, workspace_id, and idempotencyKey to query', async () => {
      await store.getProposalByIdempotencyKey(TENANT, WORKSPACE, 'my-key');
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('agent_action_proposals');
      expect(sql).toContain('idempotency_key');
      expect(params).toContain('t-1');
      expect(params).toContain('ws-1');
      expect(params).toContain('my-key');
    });

    it('does not match across workspaces', async () => {
      // No rows returned for different workspace
      const result = await store.getProposalByIdempotencyKey(
        TENANT,
        WorkspaceId('ws-other'),
        'idem-key-1',
      );
      expect(result).toBeNull();

      // Verify the query was called with the different workspace
      const [, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(params[1]).toBe('ws-other');
    });
  });
});
