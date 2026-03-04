import { describe, expect, it } from 'vitest';

import {
  AgentId,
  ApprovalId,
  CorrelationId,
  MachineId,
  PolicyId,
  ProposalId,
  UserId,
  WorkspaceId,
} from '../primitives/index.js';
import {
  AgentActionProposalParseError,
  parseAgentActionProposalV1,
  type AgentActionProposalV1,
} from './agent-action-proposal-v1.js';

function validProposal(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    proposalId: 'prop-1',
    workspaceId: 'ws-1',
    agentId: 'agent-1',
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
    policyIds: ['pol-1'],
    decision: 'Allow',
    rationale: 'Routine read-only query.',
    requestedByUserId: 'user-1',
    correlationId: 'corr-1',
    proposedAtIso: '2026-03-01T00:00:00.000Z',
  };
}

describe('parseAgentActionProposalV1', () => {
  it('parses a minimal valid proposal with branded types', () => {
    const result = parseAgentActionProposalV1(validProposal());

    expect(result.schemaVersion).toBe(1);
    expect(result.proposalId).toBe(ProposalId('prop-1'));
    expect(result.workspaceId).toBe(WorkspaceId('ws-1'));
    expect(result.agentId).toBe(AgentId('agent-1'));
    expect(result.actionKind).toBe('invoke-tool');
    expect(result.toolName).toBe('list-files');
    expect(result.executionTier).toBe('Auto');
    expect(result.decision).toBe('Allow');
    expect(result.policyDecision).toBe('Allow');
    expect(result.policyIds).toEqual([PolicyId('pol-1')]);
    expect(result.rationale).toBe('Routine read-only query.');
    expect(result.requestedByUserId).toBe(UserId('user-1'));
    expect(result.correlationId).toBe(CorrelationId('corr-1'));
    expect(result.proposedAtIso).toBe('2026-03-01T00:00:00.000Z');
    expect(result.machineId).toBeUndefined();
    expect(result.parameters).toBeUndefined();
    expect(result.approvalId).toBeUndefined();
    expect(result.idempotencyKey).toBeUndefined();
  });

  it('parses all optional fields when present', () => {
    const input = {
      ...validProposal(),
      machineId: 'mach-1',
      parameters: { path: '/tmp' },
      decision: 'NeedsApproval',
      approvalId: 'appr-1',
      idempotencyKey: 'idem-abc',
    };

    const result = parseAgentActionProposalV1(input);

    expect(result.machineId).toBe(MachineId('mach-1'));
    expect(result.parameters).toEqual({ path: '/tmp' });
    expect(result.approvalId).toBe(ApprovalId('appr-1'));
    expect(result.idempotencyKey).toBe('idem-abc');
    expect(result.decision).toBe('NeedsApproval');
  });

  it('parses Denied decision', () => {
    const input = { ...validProposal(), decision: 'Denied', policyDecision: 'Deny' };
    const result = parseAgentActionProposalV1(input);
    expect(result.decision).toBe('Denied');
    expect(result.policyDecision).toBe('Deny');
  });

  it('parses NeedsApproval with RequireApproval policyDecision', () => {
    const input = {
      ...validProposal(),
      decision: 'NeedsApproval',
      policyDecision: 'RequireApproval',
    };
    const result = parseAgentActionProposalV1(input);
    expect(result.decision).toBe('NeedsApproval');
    expect(result.policyDecision).toBe('RequireApproval');
  });

  it('parses all tool classification categories', () => {
    for (const category of ['ReadOnly', 'Mutation', 'Dangerous', 'Unknown'] as const) {
      const input = {
        ...validProposal(),
        toolClassification: {
          toolName: 'test-tool',
          category,
          minimumTier: 'HumanApprove',
          rationale: `${category} tool.`,
        },
      };
      const result = parseAgentActionProposalV1(input);
      expect(result.toolClassification.category).toBe(category);
    }
  });

  it('parses all execution tier values', () => {
    for (const tier of ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const) {
      const input = {
        ...validProposal(),
        executionTier: tier,
        toolClassification: {
          toolName: 'list-files',
          category: 'ReadOnly',
          minimumTier: tier,
          rationale: 'Read-only tool.',
        },
      };
      const result = parseAgentActionProposalV1(input);
      expect(result.executionTier).toBe(tier);
    }
  });

  it('parses multiple policyIds with deduplication at branded level', () => {
    const input = { ...validProposal(), policyIds: ['pol-1', 'pol-2', 'pol-3'] };
    const result = parseAgentActionProposalV1(input);
    expect(result.policyIds).toEqual([PolicyId('pol-1'), PolicyId('pol-2'), PolicyId('pol-3')]);
  });

  // ---------------------------------------------------------------------------
  // Negative cases
  // ---------------------------------------------------------------------------

  it('throws on non-object input', () => {
    expect(() => parseAgentActionProposalV1('not-an-object')).toThrow(
      AgentActionProposalParseError,
    );
  });

  it('throws on unsupported schemaVersion', () => {
    expect(() => parseAgentActionProposalV1({ ...validProposal(), schemaVersion: 2 })).toThrow(
      /schemaVersion/,
    );
  });

  it('throws on missing proposalId', () => {
    const { proposalId: _, ...input } = validProposal();
    expect(() => parseAgentActionProposalV1(input)).toThrow(AgentActionProposalParseError);
  });

  it('throws on empty workspaceId', () => {
    expect(() => parseAgentActionProposalV1({ ...validProposal(), workspaceId: '' })).toThrow(
      AgentActionProposalParseError,
    );
  });

  it('throws on invalid executionTier', () => {
    expect(() =>
      parseAgentActionProposalV1({ ...validProposal(), executionTier: 'Invalid' }),
    ).toThrow(/executionTier/);
  });

  it('throws on invalid decision', () => {
    expect(() => parseAgentActionProposalV1({ ...validProposal(), decision: 'Maybe' })).toThrow(
      /decision/,
    );
  });

  it('throws on invalid policyDecision', () => {
    expect(() =>
      parseAgentActionProposalV1({ ...validProposal(), policyDecision: 'Unsure' }),
    ).toThrow(/policyDecision/);
  });

  it('throws on empty policyIds array', () => {
    expect(() => parseAgentActionProposalV1({ ...validProposal(), policyIds: [] })).toThrow(
      /policyIds/,
    );
  });

  it('throws on non-array policyIds', () => {
    expect(() =>
      parseAgentActionProposalV1({ ...validProposal(), policyIds: 'not-array' }),
    ).toThrow(/policyIds/);
  });

  it('throws on invalid proposedAtIso', () => {
    expect(() =>
      parseAgentActionProposalV1({ ...validProposal(), proposedAtIso: 'not-a-date' }),
    ).toThrow(/proposedAtIso/);
  });

  it('throws on missing toolClassification', () => {
    const { toolClassification: _, ...input } = validProposal();
    expect(() => parseAgentActionProposalV1(input)).toThrow(AgentActionProposalParseError);
  });

  it('throws on invalid toolClassification.category', () => {
    expect(() =>
      parseAgentActionProposalV1({
        ...validProposal(),
        toolClassification: {
          toolName: 'x',
          category: 'BadCat',
          minimumTier: 'Auto',
          rationale: 'test',
        },
      }),
    ).toThrow(/category/);
  });

  it('throws on missing toolClassification.minimumTier', () => {
    expect(() =>
      parseAgentActionProposalV1({
        ...validProposal(),
        toolClassification: {
          toolName: 'x',
          category: 'ReadOnly',
          rationale: 'test',
        },
      }),
    ).toThrow(/minimumTier/);
  });

  // ---------------------------------------------------------------------------
  // Type-level guard: parsed result conforms to AgentActionProposalV1
  // ---------------------------------------------------------------------------

  it('returns a value assignable to AgentActionProposalV1', () => {
    const result: AgentActionProposalV1 = parseAgentActionProposalV1(validProposal());
    expect(result.schemaVersion).toBe(1);
  });
});
