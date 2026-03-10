import { describe, expect, it } from 'vitest';

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
import { InMemoryAgentActionProposalStore } from './in-memory-agent-action-proposal-store.js';

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

describe('InMemoryAgentActionProposalStore', () => {
  const tenantId = TenantId('t-1');

  it('returns null for unknown proposalId', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const result = await store.getProposalById(tenantId, ProposalId('nonexistent'));
    expect(result).toBeNull();
  });

  it('saves and retrieves a proposal', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const proposal = makeProposal();

    await store.saveProposal(tenantId, proposal);
    const result = await store.getProposalById(tenantId, proposal.proposalId);

    expect(result).toEqual(proposal);
  });

  it('overwrites on duplicate save (idempotent upsert)', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const original = makeProposal();
    const updated = makeProposal({ decision: 'NeedsApproval' });

    await store.saveProposal(tenantId, original);
    await store.saveProposal(tenantId, updated);
    const result = await store.getProposalById(tenantId, original.proposalId);

    expect(result?.decision).toBe('NeedsApproval');
  });

  it('isolates proposals by tenantId', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const tenantA = TenantId('tenant-a');
    const tenantB = TenantId('tenant-b');
    const proposal = makeProposal();

    await store.saveProposal(tenantA, proposal);

    const fromA = await store.getProposalById(tenantA, proposal.proposalId);
    const fromB = await store.getProposalById(tenantB, proposal.proposalId);

    expect(fromA).toEqual(proposal);
    expect(fromB).toBeNull();
  });

  it('stores multiple proposals independently', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const p1 = makeProposal({ proposalId: ProposalId('prop-1') });
    const p2 = makeProposal({ proposalId: ProposalId('prop-2'), decision: 'Denied' });

    await store.saveProposal(tenantId, p1);
    await store.saveProposal(tenantId, p2);

    const r1 = await store.getProposalById(tenantId, p1.proposalId);
    const r2 = await store.getProposalById(tenantId, p2.proposalId);

    expect(r1?.decision).toBe('Allow');
    expect(r2?.decision).toBe('Denied');
  });

  it('returns null for unknown idempotencyKey', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const result = await store.getProposalByIdempotencyKey(
      tenantId,
      WorkspaceId('ws-1'),
      'nonexistent-key',
    );
    expect(result).toBeNull();
  });

  it('finds proposal by idempotencyKey', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const proposal = makeProposal({ idempotencyKey: 'idem-key-1' });
    await store.saveProposal(tenantId, proposal);

    const result = await store.getProposalByIdempotencyKey(
      tenantId,
      WorkspaceId('ws-1'),
      'idem-key-1',
    );
    expect(result).toEqual(proposal);
  });

  it('does not match idempotencyKey across workspaces', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const proposal = makeProposal({ idempotencyKey: 'idem-key-2' });
    await store.saveProposal(tenantId, proposal);

    const result = await store.getProposalByIdempotencyKey(
      tenantId,
      WorkspaceId('ws-other'),
      'idem-key-2',
    );
    expect(result).toBeNull();
  });

  it('does not match proposals without idempotencyKey', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const proposal = makeProposal(); // no idempotencyKey
    await store.saveProposal(tenantId, proposal);

    const result = await store.getProposalByIdempotencyKey(
      tenantId,
      WorkspaceId('ws-1'),
      'any-key',
    );
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Unique constraint enforcement (bead-0909)
  // -------------------------------------------------------------------------

  it('silently skips duplicate idempotency key for different proposalId (first writer wins)', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const first = makeProposal({
      proposalId: ProposalId('prop-first'),
      idempotencyKey: 'shared-key',
    });
    const second = makeProposal({
      proposalId: ProposalId('prop-second'),
      idempotencyKey: 'shared-key',
    });

    await store.saveProposal(tenantId, first);
    // Second save with same idempotencyKey but different proposalId — silently skipped
    await store.saveProposal(tenantId, second);

    // First writer should win
    const result = await store.getProposalByIdempotencyKey(
      tenantId,
      WorkspaceId('ws-1'),
      'shared-key',
    );
    expect(result).toEqual(first);

    // Second proposal should not have been stored
    const secondResult = await store.getProposalById(tenantId, ProposalId('prop-second'));
    expect(secondResult).toBeNull();
  });

  it('allows upsert with same proposalId and same idempotencyKey', async () => {
    const store = new InMemoryAgentActionProposalStore();
    const proposal = makeProposal({
      proposalId: ProposalId('prop-1'),
      idempotencyKey: 'upsert-key',
    });
    const updated = makeProposal({
      proposalId: ProposalId('prop-1'),
      idempotencyKey: 'upsert-key',
      decision: 'NeedsApproval',
    });

    await store.saveProposal(tenantId, proposal);
    await store.saveProposal(tenantId, updated); // same proposalId — upsert allowed
    const result = await store.getProposalById(tenantId, ProposalId('prop-1'));
    expect(result?.decision).toBe('NeedsApproval');
  });

  // -------------------------------------------------------------------------
  // TTL expiry (bead-0909)
  // -------------------------------------------------------------------------

  it('returns null for expired idempotency key (TTL elapsed)', async () => {
    let nowMs = 1_000_000;
    const store = new InMemoryAgentActionProposalStore({
      idempotencyTtlMs: 60_000, // 1 minute
      now: () => nowMs,
    });

    const proposal = makeProposal({ idempotencyKey: 'ttl-key' });
    await store.saveProposal(tenantId, proposal);

    // Before TTL: should find it
    const before = await store.getProposalByIdempotencyKey(
      tenantId,
      WorkspaceId('ws-1'),
      'ttl-key',
    );
    expect(before).toEqual(proposal);

    // Advance time past TTL
    nowMs += 120_000; // 2 minutes later

    // After TTL: should return null
    const after = await store.getProposalByIdempotencyKey(tenantId, WorkspaceId('ws-1'), 'ttl-key');
    expect(after).toBeNull();
  });

  it('returns proposal within TTL window', async () => {
    let nowMs = 1_000_000;
    const store = new InMemoryAgentActionProposalStore({
      idempotencyTtlMs: 60_000,
      now: () => nowMs,
    });

    const proposal = makeProposal({ idempotencyKey: 'ttl-ok' });
    await store.saveProposal(tenantId, proposal);

    // Advance time but within TTL
    nowMs += 30_000; // 30 seconds later

    const result = await store.getProposalByIdempotencyKey(tenantId, WorkspaceId('ws-1'), 'ttl-ok');
    expect(result).toEqual(proposal);
  });

  // -------------------------------------------------------------------------
  // Cross-workspace idempotency key isolation (bead-0909)
  // -------------------------------------------------------------------------

  it('allows same idempotencyKey in different workspaces', async () => {
    const store = new InMemoryAgentActionProposalStore();

    const proposalWs1 = makeProposal({
      proposalId: ProposalId('prop-ws1'),
      workspaceId: WorkspaceId('ws-1'),
      idempotencyKey: 'cross-ws-key',
    });
    const proposalWs2 = makeProposal({
      proposalId: ProposalId('prop-ws2'),
      workspaceId: WorkspaceId('ws-2'),
      idempotencyKey: 'cross-ws-key',
    });

    await store.saveProposal(tenantId, proposalWs1);
    await store.saveProposal(tenantId, proposalWs2);

    const fromWs1 = await store.getProposalByIdempotencyKey(
      tenantId,
      WorkspaceId('ws-1'),
      'cross-ws-key',
    );
    const fromWs2 = await store.getProposalByIdempotencyKey(
      tenantId,
      WorkspaceId('ws-2'),
      'cross-ws-key',
    );

    expect(fromWs1).not.toBeNull();
    expect(fromWs2).not.toBeNull();
    expect(String(fromWs1!.proposalId)).toBe('prop-ws1');
    expect(String(fromWs2!.proposalId)).toBe('prop-ws2');
  });

  it('allows multiple proposals with no idempotencyKey', async () => {
    const store = new InMemoryAgentActionProposalStore();

    const p1 = makeProposal({ proposalId: ProposalId('no-key-1') });
    const p2 = makeProposal({ proposalId: ProposalId('no-key-2') });

    await store.saveProposal(tenantId, p1);
    await store.saveProposal(tenantId, p2);

    const r1 = await store.getProposalById(tenantId, ProposalId('no-key-1'));
    const r2 = await store.getProposalById(tenantId, ProposalId('no-key-2'));

    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(String(r1!.proposalId)).toBe('no-key-1');
    expect(String(r2!.proposalId)).toBe('no-key-2');
  });
});
