import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AgentId,
  ApprovalId,
  CorrelationId,
  EvidenceId,
  PolicyId,
  ProposalId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import { parseApprovalV1 } from '../../domain/approvals/approval-v1.js';
import type { AgentActionProposalV1 } from '../../domain/machines/index.js';
import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import {
  type AgentActionProposalStore,
  type ApprovalStore,
  type AuthorizationPort,
  type Clock,
  type EventPublisher,
  type EvidenceLogPort,
  type IdGenerator,
  type IdempotencyStore,
  type UnitOfWork,
} from '../ports/index.js';
import { HashSha256 } from '../../domain/primitives/index.js';
import { submitApproval } from './submit-approval.js';

const PENDING_APPROVAL = parseApprovalV1({
  schemaVersion: 1,
  approvalId: 'approval-1',
  workspaceId: 'ws-1',
  runId: 'run-1',
  planId: 'plan-1',
  prompt: 'Approve run.',
  requestedAtIso: '2026-02-17T00:00:00.000Z',
  requestedByUserId: 'user-2',
  status: 'Pending',
});

const AGENT_ACTION_APPROVAL = parseApprovalV1({
  schemaVersion: 1,
  approvalId: 'approval-agent-1',
  workspaceId: 'ws-1',
  runId: 'proposal-1',
  planId: 'proposal-1',
  prompt: 'Approve agent action.',
  requestedAtIso: '2026-02-17T00:00:00.000Z',
  requestedByUserId: 'user-2',
  status: 'Pending',
});

function makeAgentActionProposal(
  overrides: Partial<AgentActionProposalV1> = {},
): AgentActionProposalV1 {
  return {
    schemaVersion: 1,
    proposalId: ProposalId('proposal-1'),
    workspaceId: WorkspaceId('ws-1'),
    agentId: AgentId('agent-1'),
    actionKind: 'invoke-tool',
    toolName: 'write-record',
    executionTier: 'HumanApprove',
    toolClassification: {
      toolName: 'write-record',
      category: 'Mutation',
      minimumTier: 'HumanApprove',
      rationale: 'Writes external state.',
    },
    policyDecision: 'RequireApproval',
    policyIds: [PolicyId('policy-1')],
    decision: 'NeedsApproval',
    approvalId: AGENT_ACTION_APPROVAL.approvalId,
    rationale: 'Needs operator review.',
    requestedByUserId: UserId('user-2'),
    correlationId: CorrelationId('corr-proposal-1'),
    proposedAtIso: '2026-02-17T00:00:00.000Z',
    evidenceId: EvidenceId('evidence-1'),
    ...overrides,
  };
}

function makeAgentActionProposalStore(
  proposal: AgentActionProposalV1 | null,
): AgentActionProposalStore {
  return {
    getProposalById: vi.fn(async () => proposal),
    getProposalByApprovalId: vi.fn(async () => proposal),
    getProposalByIdempotencyKey: vi.fn(async () => null),
    saveProposal: vi.fn(async () => undefined),
  };
}

describe('submitApproval', () => {
  let authorization: AuthorizationPort;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let approvalStore: ApprovalStore;
  let unitOfWork: UnitOfWork;
  let eventPublisher: EventPublisher;
  let evidenceLog: EvidenceLogPort;
  let idempotency: IdempotencyStore;

  beforeEach(() => {
    authorization = { isAllowed: vi.fn(async () => true) };
    clock = { nowIso: vi.fn(() => '2026-02-17T00:02:00.000Z') };
    idGenerator = { generateId: vi.fn(() => 'evt-1') };
    approvalStore = {
      getApprovalById: vi.fn(async () => PENDING_APPROVAL),
      saveApproval: vi.fn(async () => undefined),
    };
    unitOfWork = { execute: vi.fn(async (fn) => fn()) };
    eventPublisher = { publish: vi.fn(async () => undefined) };
    evidenceLog = {
      appendEntry: vi.fn(async (_tenantId, entry) => ({
        ...entry,
        previousHash: HashSha256(''),
        hashSha256: HashSha256('abc'),
      })),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits approval decision and emits event', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Looks good.',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success response.');
    }
    expect(result.value.status).toBe('Approved');
    expect(approvalStore.saveApproval).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
  });

  it('rejects missing authorization', async () => {
    authorization.isAllowed = vi.fn(async () => false);
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['auditor'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Denied',
        rationale: 'Denied.',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected forbidden response.');
    }
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.approvalSubmit,
    );
  });

  it('accepts RequestChanges decision and emits ApprovalChangesRequested event', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'RequestChanges',
        rationale: 'Need updates.',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success response.');
    }
    expect(result.value.status).toBe('RequestChanges');
    expect(approvalStore.saveApproval).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);

    const published = (eventPublisher.publish as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(published['type']).toBe('com.portarium.approval.ApprovalChangesRequested');
  });

  it('rejects empty timestamp from clock', async () => {
    clock.nowIso = vi.fn(() => '');
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Denied',
        rationale: 'Denied.',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('rejects empty generated event identifier', async () => {
    idGenerator.generateId = vi.fn(() => '');
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Denied',
        rationale: 'Denied.',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('rejects approval workspace mismatch', async () => {
    const mismatchedApproval = parseApprovalV1({
      schemaVersion: 1,
      approvalId: 'approval-1',
      workspaceId: 'ws-other',
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'Approve run.',
      requestedAtIso: '2026-02-17T00:00:00.000Z',
      requestedByUserId: 'user-2',
      status: 'Pending',
    });
    approvalStore = {
      getApprovalById: vi.fn(async () => mismatchedApproval),
      saveApproval: vi.fn(async () => undefined),
    };

    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Looks good.',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected forbidden response.');
    }
    expect(result.error.kind).toBe('Forbidden');
  });

  it('blocks maker-checker self-approval unconditionally (no SoD constraints needed)', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-2', // same as requestedByUserId in PENDING_APPROVAL
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Self-approve attempt.',
        // No sodConstraints — unconditional maker-checker should still block
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected forbidden response.');
    }
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/maker-checker/i);
    expect(approvalStore.saveApproval).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('blocks hazardous-zone mission proposer self-approval', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'approver-hz', // different from requestedByUserId to pass maker-checker
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Hazardous-zone self-approve attempt.',
        sodConstraints: [{ kind: 'HazardousZoneNoSelfApproval' }],
        robotContext: {
          hazardousZone: true,
          missionProposerUserId: UserId('approver-hz'),
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected forbidden response.');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/HazardousZoneNoSelfApprovalViolation/i);
    expect(approvalStore.saveApproval).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('blocks remote e-stop requester from self-authorizing approval decision', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'approver-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Remote stop self-authorize attempt.',
        sodConstraints: [{ kind: 'RemoteEstopRequesterSeparation' }],
        robotContext: {
          remoteEstopRequest: true,
          estopRequesterUserId: UserId('approver-1'),
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected forbidden response.');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/RemoteEstopRequesterSeparationViolation/i);
    expect(approvalStore.saveApproval).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('allows safety-classified zone approval after a distinct prior approver is provided', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'approver-2',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Second approver for safety zone.',
        sodConstraints: [{ kind: 'SafetyClassifiedZoneDualApproval' }],
        previousApproverIds: ['approver-1'],
        robotContext: {
          safetyClassifiedZone: true,
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success response.');
    expect(result.value.status).toBe('Approved');
    expect(approvalStore.saveApproval).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid previousApproverIds payloads', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'approver-2',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Bad payload.',
        previousApproverIds: [''],
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/previousApproverIds/i);
  });

  it('blocks decision when distinct-approver threshold is unmet', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Need two approvers.',
        sodConstraints: [{ kind: 'DistinctApprovers', minimumApprovers: 2 }],
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected forbidden response.');
    }
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/DistinctApproversViolation/i);
    expect(approvalStore.saveApproval).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('returns NotFound when approval does not exist', async () => {
    approvalStore.getApprovalById = vi.fn(async () => null);
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-missing',
        decision: 'Approved',
        rationale: 'Looks good.',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected not-found response.');
    expect(result.error.kind).toBe('NotFound');
    expect(result.error.message).toMatch(/not found/i);
  });

  it('returns Conflict when approval is already decided', async () => {
    const decidedApproval = parseApprovalV1({
      schemaVersion: 1,
      approvalId: 'approval-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'Approve run.',
      requestedAtIso: '2026-02-17T00:00:00.000Z',
      requestedByUserId: 'user-2',
      status: 'Approved',
      decidedAtIso: '2026-02-17T00:01:00.000Z',
      decidedByUserId: 'user-3',
      rationale: 'Already approved.',
    });
    approvalStore.getApprovalById = vi.fn(async () => decidedApproval);

    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Denied',
        rationale: 'Too late.',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict response.');
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toMatch(/already decided/i);
  });

  it('rejects orphan agent-action approvals when the linked proposal is missing', async () => {
    approvalStore.getApprovalById = vi.fn(async () => AGENT_ACTION_APPROVAL);
    const agentActionProposalStore = makeAgentActionProposalStore(null);

    const result = await submitApproval(
      {
        authorization,
        clock,
        idGenerator,
        approvalStore,
        unitOfWork,
        eventPublisher,
        agentActionProposalStore,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-agent-1',
        decision: 'Approved',
        rationale: 'Looks good.',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict response.');
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toMatch(/agent action proposal/i);
    expect(agentActionProposalStore.getProposalById).toHaveBeenCalled();
    expect(approvalStore.saveApproval).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('rejects agent-action approvals whose proposal link does not match the approval', async () => {
    approvalStore.getApprovalById = vi.fn(async () => AGENT_ACTION_APPROVAL);
    const agentActionProposalStore = makeAgentActionProposalStore(
      makeAgentActionProposal({ proposalId: ProposalId('proposal-other') }),
    );

    const result = await submitApproval(
      {
        authorization,
        clock,
        idGenerator,
        approvalStore,
        unitOfWork,
        eventPublisher,
        agentActionProposalStore,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-agent-1',
        decision: 'Approved',
        rationale: 'Looks good.',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict response.');
    expect(result.error.kind).toBe('Conflict');
    expect(approvalStore.saveApproval).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('allows agent-action approvals when the linked proposal matches', async () => {
    approvalStore.getApprovalById = vi.fn(async () => AGENT_ACTION_APPROVAL);
    const agentActionProposalStore = makeAgentActionProposalStore(makeAgentActionProposal());

    const result = await submitApproval(
      {
        authorization,
        clock,
        idGenerator,
        approvalStore,
        unitOfWork,
        eventPublisher,
        agentActionProposalStore,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-agent-1',
        decision: 'Approved',
        rationale: 'Looks good.',
      },
    );

    expect(result.ok).toBe(true);
    expect(approvalStore.saveApproval).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
  });

  it('happy path: Denied decision emits ApprovalDenied event', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Denied',
        rationale: 'Risk too high.',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success response.');
    expect(result.value.status).toBe('Denied');
    expect(approvalStore.saveApproval).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);

    const published = (eventPublisher.publish as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(published['type']).toBe('com.portarium.approval.ApprovalDenied');
  });

  it('records evidence when evidenceLog is provided', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher, evidenceLog },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Approved with evidence.',
      },
    );

    expect(result.ok).toBe(true);
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
    const call = (evidenceLog.appendEntry as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(call[0])).toBe('tenant-1'); // tenantId
    const entry = call[1] as Record<string, unknown>;
    expect(entry['category']).toBe('Approval');
    expect(entry['summary'] as string).toMatch(/Approved/);
  });

  it('succeeds without evidence when evidenceLog is not provided', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'No evidence log.',
      },
    );

    expect(result.ok).toBe(true);
    // No crash — evidenceLog was not provided and that's fine.
  });

  it('stores idempotency result after a successful approval decision', async () => {
    idempotency = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
    };

    const result = await submitApproval(
      {
        authorization,
        clock,
        idGenerator,
        approvalStore,
        unitOfWork,
        eventPublisher,
        evidenceLog,
        idempotency,
      } as Parameters<typeof submitApproval>[0] & { idempotency: IdempotencyStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Approved with retry key.',
        idempotencyKey: 'approval-decision-1',
      },
    );

    expect(result.ok).toBe(true);
    expect(idempotency.set).toHaveBeenCalledWith(
      {
        tenantId: TenantId('tenant-1'),
        commandName: 'SubmitApproval',
        requestKey: 'approval-decision-1',
      },
      expect.objectContaining({
        fingerprint: expect.any(String),
        output: expect.objectContaining({ status: 'Approved' }),
      }),
    );
  });

  it('replays a matching idempotency key without duplicate event or evidence', async () => {
    const cache = new Map<string, unknown>();
    idempotency = {
      get: async <T>(key: Parameters<IdempotencyStore['get']>[0]) =>
        (cache.get(`${key.tenantId}:${key.commandName}:${key.requestKey}`) as T | undefined) ??
        null,
      set: vi.fn(async (key, value) => {
        cache.set(`${key.tenantId}:${key.commandName}:${key.requestKey}`, value);
      }),
    };
    const ctx = toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['approver'],
    });
    const input = {
      workspaceId: 'ws-1',
      approvalId: 'approval-1',
      decision: 'Approved' as const,
      rationale: 'Approved with retry key.',
      idempotencyKey: 'approval-decision-2',
    };

    const first = await submitApproval(
      {
        authorization,
        clock,
        idGenerator,
        approvalStore,
        unitOfWork,
        eventPublisher,
        evidenceLog,
        idempotency,
      },
      ctx,
      input,
    );
    expect(first.ok).toBe(true);
    vi.mocked(approvalStore.saveApproval).mockClear();
    vi.mocked(eventPublisher.publish).mockClear();
    vi.mocked(evidenceLog.appendEntry).mockClear();

    const second = await submitApproval(
      {
        authorization,
        clock,
        idGenerator,
        approvalStore,
        unitOfWork,
        eventPublisher,
        evidenceLog,
        idempotency,
      },
      ctx,
      input,
    );

    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('Expected replay success.');
    expect(second.value).toEqual({
      approvalId: ApprovalId('approval-1'),
      status: 'Approved',
      replayed: true,
    });
    expect(approvalStore.saveApproval).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
    expect(evidenceLog.appendEntry).not.toHaveBeenCalled();
  });

  it('allows only one concurrent first decision to publish event and evidence', async () => {
    const approvals = new Map<string, ReturnType<typeof parseApprovalV1>>([
      ['tenant-1:ws-1:approval-1', PENDING_APPROVAL],
    ]);
    let readCount = 0;
    let releaseReads: (() => void) | undefined;
    const bothRead = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    approvalStore = {
      getApprovalById: vi.fn(async (tenantId, workspaceId, approvalId) => {
        readCount += 1;
        const approval = approvals.get(`${tenantId}:${workspaceId}:${approvalId}`) ?? null;
        if (readCount === 2) releaseReads?.();
        if (readCount <= 2) await bothRead;
        return approval;
      }),
      saveApproval: vi.fn(async (_tenantId, approval) => {
        approvals.set(`tenant-1:${approval.workspaceId}:${approval.approvalId}`, approval);
      }),
      saveApprovalIfStatus: vi.fn(
        async (tenantId, workspaceId, approvalId, expectedStatus, next) => {
          const key = `${tenantId}:${workspaceId}:${approvalId}`;
          const current = approvals.get(key);
          if (!current || current.status !== expectedStatus) return false;
          approvals.set(key, next);
          return true;
        },
      ),
    };

    const ctx = toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['approver'],
    });
    const input = {
      workspaceId: 'ws-1',
      approvalId: 'approval-1',
      decision: 'Approved' as const,
      rationale: 'Concurrent approval.',
    };

    const [first, second] = await Promise.all([
      submitApproval(
        {
          authorization,
          clock,
          idGenerator,
          approvalStore,
          unitOfWork,
          eventPublisher,
          evidenceLog,
        },
        ctx,
        input,
      ),
      submitApproval(
        {
          authorization,
          clock,
          idGenerator,
          approvalStore,
          unitOfWork,
          eventPublisher,
          evidenceLog,
        },
        ctx,
        input,
      ),
    ]);

    const results = [first, second];
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.error.kind === 'Conflict')).toHaveLength(
      1,
    );
    expect(approvalStore.saveApprovalIfStatus).toHaveBeenCalledTimes(2);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
    expect(approvals.get('tenant-1:ws-1:approval-1')?.status).toBe('Approved');
  });

  it('rejects an idempotency replay with a different decision payload', async () => {
    const cache = new Map<string, unknown>();
    idempotency = {
      get: async <T>(key: Parameters<IdempotencyStore['get']>[0]) =>
        (cache.get(`${key.tenantId}:${key.commandName}:${key.requestKey}`) as T | undefined) ??
        null,
      set: vi.fn(async (key, value) => {
        cache.set(`${key.tenantId}:${key.commandName}:${key.requestKey}`, value);
      }),
    };
    const ctx = toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['approver'],
    });

    await submitApproval(
      {
        authorization,
        clock,
        idGenerator,
        approvalStore,
        unitOfWork,
        eventPublisher,
        evidenceLog,
        idempotency,
      },
      ctx,
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'First decision.',
        idempotencyKey: 'approval-decision-3',
      },
    );
    vi.mocked(approvalStore.saveApproval).mockClear();
    vi.mocked(eventPublisher.publish).mockClear();
    vi.mocked(evidenceLog.appendEntry).mockClear();

    const replay = await submitApproval(
      {
        authorization,
        clock,
        idGenerator,
        approvalStore,
        unitOfWork,
        eventPublisher,
        evidenceLog,
        idempotency,
      },
      ctx,
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Denied',
        rationale: 'Different decision.',
        idempotencyKey: 'approval-decision-3',
      },
    );

    expect(replay.ok).toBe(false);
    if (replay.ok) throw new Error('Expected conflict.');
    expect(replay.error.kind).toBe('Conflict');
    expect(approvalStore.saveApproval).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
    expect(evidenceLog.appendEntry).not.toHaveBeenCalled();
  });

  it('rejects invalid robotContext payloads', async () => {
    const result = await submitApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        approvalId: 'approval-1',
        decision: 'Approved',
        rationale: 'Bad robot context.',
        robotContext: {
          hazardousZone: true,
          missionProposerUserId: '',
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/robotContext\.missionProposerUserId/i);
  });
});
