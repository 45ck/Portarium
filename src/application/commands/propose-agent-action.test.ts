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
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
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
  });
});
