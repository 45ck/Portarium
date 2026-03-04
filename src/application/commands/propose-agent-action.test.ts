import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parsePolicyV1, type PolicyV1 } from '../../domain/policy/index.js';
import { toAppContext } from '../common/context.js';
import type {
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdGenerator,
  PolicyStore,
  UnitOfWork,
} from '../ports/index.js';
import { InMemoryAgentActionProposalStore } from '../../infrastructure/stores/in-memory-agent-action-proposal-store.js';
import { proposeAgentAction } from './propose-agent-action.js';

function makePolicy(overrides: Partial<PolicyV1> = {}): PolicyV1 {
  return parsePolicyV1({
    schemaVersion: 1,
    policyId: 'pol-1',
    workspaceId: 'ws-1',
    name: 'Agent Action Governance Policy',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-02-20T00:00:00.000Z',
    createdByUserId: 'policy-admin-1',
    ...overrides,
  });
}

describe('proposeAgentAction', () => {
  let authorization: AuthorizationPort;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let unitOfWork: UnitOfWork;
  let policyStore: PolicyStore;
  let approvalStore: ApprovalStore;
  let eventPublisher: EventPublisher;
  let evidenceLog: EvidenceLogPort;

  beforeEach(() => {
    authorization = { isAllowed: vi.fn(async () => true) };
    clock = { nowIso: vi.fn(() => '2026-02-20T03:12:00.000Z') };
    let idSeq = 0;
    idGenerator = { generateId: vi.fn(() => `id-${++idSeq}`) };
    unitOfWork = { execute: vi.fn(async (fn) => fn()) };
    policyStore = { getPolicyById: vi.fn(async () => makePolicy()) };
    approvalStore = {
      getApprovalById: vi.fn(async () => null),
      saveApproval: vi.fn(async () => undefined),
    };
    eventPublisher = { publish: vi.fn(async () => undefined) };
    evidenceLog = {
      appendEntry: vi.fn(async (_tenantId, entry) => ({
        ...entry,
        hashSha256: 'hash-sha-256' as never,
      })),
    };
  });

  const deps = () => ({
    authorization,
    clock,
    idGenerator,
    unitOfWork,
    policyStore,
    approvalStore,
    eventPublisher,
    evidenceLog,
  });

  const ctx = () =>
    toAppContext({
      tenantId: 'ws-1',
      principalId: 'operator-1',
      correlationId: 'corr-agent-1',
      roles: ['operator'],
    });

  it('allows ReadOnly tool at Auto tier', async () => {
    const result = await proposeAgentAction(deps(), ctx(), {
      workspaceId: 'ws-1',
      agentId: 'agent-email-reader',
      actionKind: 'comms:listEmails',
      toolName: 'email:list',
      executionTier: 'Auto',
      policyIds: ['pol-1'],
      rationale: 'Agent needs to read recent emails.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success.');
    expect(result.value.decision).toBe('Allow');
    expect(result.value.proposalId).toBeDefined();
    expect(result.value.evidenceId).toBeDefined();
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
  });

  it('returns NeedsApproval for Mutation tool (sendEmail)', async () => {
    const result = await proposeAgentAction(deps(), ctx(), {
      workspaceId: 'ws-1',
      agentId: 'agent-email-sender',
      actionKind: 'comms:sendEmail',
      toolName: 'email:send',
      executionTier: 'HumanApprove',
      policyIds: ['pol-1'],
      rationale: 'Agent wants to send an email.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success.');
    expect(result.value.decision).toBe('NeedsApproval');
    expect(result.value.message).toMatch(/send/i);
    expect(result.value.approvalId).toBeDefined();
    expect(typeof result.value.approvalId).toBe('string');
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
    expect(approvalStore.saveApproval).toHaveBeenCalledTimes(1);
  });

  it('denies Dangerous tool (shell.exec)', async () => {
    const result = await proposeAgentAction(deps(), ctx(), {
      workspaceId: 'ws-1',
      agentId: 'agent-dangerous',
      actionKind: 'system:exec',
      toolName: 'shell:exec',
      executionTier: 'ManualOnly',
      policyIds: ['pol-1'],
      rationale: 'Agent wants to run a shell command.',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected rejection.');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/Dangerous/);
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthorized callers', async () => {
    authorization = { isAllowed: vi.fn(async () => false) };

    const result = await proposeAgentAction(deps(), ctx(), {
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      actionKind: 'comms:sendEmail',
      toolName: 'email:send',
      executionTier: 'HumanApprove',
      policyIds: ['pol-1'],
      rationale: 'Not permitted.',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected rejection.');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/not permitted/i);
  });

  it('rejects workspace mismatch', async () => {
    const result = await proposeAgentAction(deps(), ctx(), {
      workspaceId: 'ws-other',
      agentId: 'agent-1',
      actionKind: 'comms:sendEmail',
      toolName: 'email:send',
      executionTier: 'HumanApprove',
      policyIds: ['pol-1'],
      rationale: 'Cross-workspace attempt.',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected rejection.');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/mismatch/i);
  });

  it('returns NotFound when policy does not exist', async () => {
    policyStore = { getPolicyById: vi.fn(async () => null) };

    const result = await proposeAgentAction(deps(), ctx(), {
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      actionKind: 'comms:sendEmail',
      toolName: 'email:send',
      executionTier: 'HumanApprove',
      policyIds: ['pol-missing'],
      rationale: 'Policy not found.',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected rejection.');
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns ValidationFailed for empty agentId', async () => {
    const result = await proposeAgentAction(deps(), ctx(), {
      workspaceId: 'ws-1',
      agentId: '',
      actionKind: 'comms:sendEmail',
      toolName: 'email:send',
      executionTier: 'HumanApprove',
      policyIds: ['pol-1'],
      rationale: 'Missing agent.',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected rejection.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/agentId/);
  });

  it('creates a Pending approval record for NeedsApproval decisions', async () => {
    const result = await proposeAgentAction(deps(), ctx(), {
      workspaceId: 'ws-1',
      agentId: 'agent-email-sender',
      actionKind: 'comms:sendEmail',
      toolName: 'email:send',
      executionTier: 'HumanApprove',
      policyIds: ['pol-1'],
      rationale: 'Agent wants to send an email.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success.');
    expect(result.value.decision).toBe('NeedsApproval');
    expect(result.value.approvalId).toBeDefined();

    // Verify the approval was persisted with correct shape
    const saveCall = vi.mocked(approvalStore.saveApproval).mock.calls[0]!;
    const savedApproval = saveCall[1];
    expect(savedApproval.status).toBe('Pending');
    expect(savedApproval.schemaVersion).toBe(1);
    expect(String(savedApproval.approvalId)).toBe(result.value.approvalId);
    expect(String(savedApproval.workspaceId)).toBe('ws-1');
    expect(savedApproval.prompt).toMatch(/email:send/);
    expect(savedApproval.prompt).toMatch(/Mutation/);
    expect(String(savedApproval.requestedByUserId)).toBe('operator-1');
  });

  it('does not call saveApproval for Allow decisions', async () => {
    const result = await proposeAgentAction(deps(), ctx(), {
      workspaceId: 'ws-1',
      agentId: 'agent-email-reader',
      actionKind: 'comms:listEmails',
      toolName: 'email:list',
      executionTier: 'Auto',
      policyIds: ['pol-1'],
      rationale: 'Agent needs to read recent emails.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success.');
    expect(result.value.decision).toBe('Allow');
    expect(result.value.approvalId).toBeUndefined();
    expect(approvalStore.saveApproval).not.toHaveBeenCalled();
  });

  it('returns NeedsApproval for Unknown tool category', async () => {
    const result = await proposeAgentAction(deps(), ctx(), {
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      actionKind: 'custom:mystery',
      toolName: 'mystery-tool',
      executionTier: 'HumanApprove',
      policyIds: ['pol-1'],
      rationale: 'Unknown tool.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success.');
    expect(result.value.decision).toBe('NeedsApproval');
    expect(result.value.approvalId).toBeDefined();
    expect(approvalStore.saveApproval).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Idempotency deduplication
  // -------------------------------------------------------------------------

  it('returns existing proposal for duplicate idempotencyKey (Allow)', async () => {
    const proposalStore = new InMemoryAgentActionProposalStore();
    const depsWithStore = () => ({ ...deps(), proposalStore });

    const input = {
      workspaceId: 'ws-1',
      agentId: 'agent-email-reader',
      actionKind: 'comms:listEmails',
      toolName: 'email:list',
      executionTier: 'Auto' as const,
      policyIds: ['pol-1'],
      rationale: 'Agent needs to read recent emails.',
      idempotencyKey: 'idem-allow-1',
    };

    // First call: should evaluate policy and persist
    const first = await proposeAgentAction(depsWithStore(), ctx(), input);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Expected success.');
    expect(first.value.decision).toBe('Allow');
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);

    // Second call with same idempotencyKey: should return cached result
    const second = await proposeAgentAction(depsWithStore(), ctx(), input);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('Expected success.');
    expect(second.value.decision).toBe('Allow');
    expect(second.value.proposalId).toBe(first.value.proposalId);
    // Evidence should NOT be appended again
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('returns existing proposal for duplicate idempotencyKey (NeedsApproval)', async () => {
    const proposalStore = new InMemoryAgentActionProposalStore();
    const depsWithStore = () => ({ ...deps(), proposalStore });

    const input = {
      workspaceId: 'ws-1',
      agentId: 'agent-email-sender',
      actionKind: 'comms:sendEmail',
      toolName: 'email:send',
      executionTier: 'HumanApprove' as const,
      policyIds: ['pol-1'],
      rationale: 'Agent wants to send an email.',
      idempotencyKey: 'idem-approval-1',
    };

    const first = await proposeAgentAction(depsWithStore(), ctx(), input);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Expected success.');
    expect(first.value.decision).toBe('NeedsApproval');
    expect(first.value.approvalId).toBeDefined();

    const second = await proposeAgentAction(depsWithStore(), ctx(), input);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('Expected success.');
    expect(second.value.decision).toBe('NeedsApproval');
    expect(second.value.proposalId).toBe(first.value.proposalId);
    expect(second.value.approvalId).toBe(first.value.approvalId);
    // Evidence and approval should NOT be written again
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
    expect(approvalStore.saveApproval).toHaveBeenCalledTimes(1);
  });

  it('treats different idempotencyKeys as distinct proposals', async () => {
    const proposalStore = new InMemoryAgentActionProposalStore();
    const depsWithStore = () => ({ ...deps(), proposalStore });

    const baseInput = {
      workspaceId: 'ws-1',
      agentId: 'agent-email-reader',
      actionKind: 'comms:listEmails',
      toolName: 'email:list',
      executionTier: 'Auto' as const,
      policyIds: ['pol-1'],
      rationale: 'Read emails.',
    };

    const first = await proposeAgentAction(depsWithStore(), ctx(), {
      ...baseInput,
      idempotencyKey: 'key-a',
    });
    const second = await proposeAgentAction(depsWithStore(), ctx(), {
      ...baseInput,
      idempotencyKey: 'key-b',
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('Expected success.');
    expect(first.value.proposalId).not.toBe(second.value.proposalId);
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(2);
  });

  it('skips idempotency check when proposalStore is not provided', async () => {
    // Without proposalStore, idempotencyKey is ignored
    const input = {
      workspaceId: 'ws-1',
      agentId: 'agent-email-reader',
      actionKind: 'comms:listEmails',
      toolName: 'email:list',
      executionTier: 'Auto' as const,
      policyIds: ['pol-1'],
      rationale: 'Read emails.',
      idempotencyKey: 'idem-no-store',
    };

    const first = await proposeAgentAction(deps(), ctx(), input);
    const second = await proposeAgentAction(deps(), ctx(), input);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('Expected success.');
    // Without store, both calls evaluate fresh — different proposalIds
    expect(first.value.proposalId).not.toBe(second.value.proposalId);
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(2);
  });
});
