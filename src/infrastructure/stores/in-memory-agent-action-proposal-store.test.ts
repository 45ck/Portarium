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
});
