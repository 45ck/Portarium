import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApprovalId,
  PlanId,
  RunId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { ApprovalDecidedV1 } from '../../domain/approvals/index.js';
import { toAppContext } from '../common/context.js';
import type {
  ActionRunnerPort,
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  UnitOfWork,
} from '../ports/index.js';
import { executeApprovedAgentAction } from './execute-approved-agent-action.js';

const APPROVED: ApprovalDecidedV1 = {
  schemaVersion: 1,
  approvalId: ApprovalId('appr-1'),
  workspaceId: WorkspaceId('ws-1'),
  runId: RunId('run-1'),
  planId: PlanId('plan-1'),
  prompt: 'Execute tool.',
  requestedAtIso: '2026-03-01T00:00:00.000Z',
  requestedByUserId: UserId('user-2'),
  status: 'Approved',
  decidedAtIso: '2026-03-01T00:01:00.000Z',
  decidedByUserId: UserId('approver-1'),
  rationale: 'Approved.',
};

describe('executeApprovedAgentAction', () => {
  let authorization: AuthorizationPort;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let approvalStore: ApprovalStore;
  let unitOfWork: UnitOfWork;
  let eventPublisher: EventPublisher;
  let actionRunner: ActionRunnerPort;

  beforeEach(() => {
    authorization = { isAllowed: vi.fn(async () => true) };
    clock = { nowIso: vi.fn(() => '2026-03-01T00:05:00.000Z') };
    let callCount = 0;
    idGenerator = {
      generateId: vi.fn(() => {
        callCount++;
        return `id-${callCount}`;
      }),
    };
    approvalStore = {
      getApprovalById: vi.fn(async () => APPROVED),
      saveApproval: vi.fn(async () => undefined),
    };
    unitOfWork = { execute: vi.fn(async (fn) => fn()) };
    eventPublisher = { publish: vi.fn(async () => undefined) };
    actionRunner = {
      dispatchAction: vi.fn(async () => ({ ok: true as const, output: { result: 'done' } })),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeDeps = () => ({
    authorization,
    clock,
    idGenerator,
    approvalStore,
    unitOfWork,
    eventPublisher,
    actionRunner,
  });

  const makeCtx = () =>
    toAppContext({
      tenantId: 'tenant-1',
      principalId: 'agent-1',
      correlationId: 'corr-exec-1',
      roles: ['operator'],
    });

  const makeInput = () => ({
    workspaceId: 'ws-1',
    approvalId: 'appr-1',
    flowRef: 'flow-abc',
    payload: { key: 'value' },
  });

  it('executes approved action and emits AgentActionExecuted event', async () => {
    const result = await executeApprovedAgentAction(makeDeps(), makeCtx(), makeInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success.');
    expect(result.value.status).toBe('Executed');
    expect(result.value.output).toEqual({ result: 'done' });
    expect(actionRunner.dispatchAction).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);

    const published = (eventPublisher.publish as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(published['type']).toBe(
      'com.portarium.agentactionproposal.AgentActionExecuted',
    );
  });

  it('returns Failed status on dispatch failure and emits AgentActionExecutionFailed', async () => {
    actionRunner.dispatchAction = vi.fn(async () => ({
      ok: false as const,
      errorKind: 'Timeout' as const,
      message: 'Action timed out.',
    }));

    const result = await executeApprovedAgentAction(makeDeps(), makeCtx(), makeInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success.');
    expect(result.value.status).toBe('Failed');
    expect(result.value.errorMessage).toBe('Action timed out.');
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);

    const published = (eventPublisher.publish as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(published['type']).toBe(
      'com.portarium.agentactionproposal.AgentActionExecutionFailed',
    );
  });

  it('returns Forbidden when authorization is denied', async () => {
    authorization.isAllowed = vi.fn(async () => false);
    const result = await executeApprovedAgentAction(makeDeps(), makeCtx(), makeInput());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected forbidden.');
    expect(result.error.kind).toBe('Forbidden');
    expect(actionRunner.dispatchAction).not.toHaveBeenCalled();
  });

  it('returns NotFound when approval does not exist', async () => {
    approvalStore.getApprovalById = vi.fn(async () => null);
    const result = await executeApprovedAgentAction(makeDeps(), makeCtx(), makeInput());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected not-found.');
    expect(result.error.kind).toBe('NotFound');
    expect(actionRunner.dispatchAction).not.toHaveBeenCalled();
  });

  it('returns Conflict when approval is not in Approved status', async () => {
    approvalStore.getApprovalById = vi.fn(async () => ({
      ...APPROVED,
      status: 'Pending' as const,
    }));
    const result = await executeApprovedAgentAction(makeDeps(), makeCtx(), makeInput());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict.');
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toMatch(/not in Approved status/);
    expect(actionRunner.dispatchAction).not.toHaveBeenCalled();
  });

  it('returns Conflict when approval is Denied', async () => {
    approvalStore.getApprovalById = vi.fn(async () => ({
      ...APPROVED,
      status: 'Denied' as const,
    }));
    const result = await executeApprovedAgentAction(makeDeps(), makeCtx(), makeInput());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict.');
    expect(result.error.kind).toBe('Conflict');
  });

  it('returns ValidationFailed for empty workspaceId', async () => {
    const result = await executeApprovedAgentAction(makeDeps(), makeCtx(), {
      ...makeInput(),
      workspaceId: '',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/workspaceId/);
  });

  it('returns ValidationFailed for empty flowRef', async () => {
    const result = await executeApprovedAgentAction(makeDeps(), makeCtx(), {
      ...makeInput(),
      flowRef: '',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/flowRef/);
  });

  it('passes correct dispatch input to action runner', async () => {
    await executeApprovedAgentAction(makeDeps(), makeCtx(), makeInput());

    expect(actionRunner.dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        flowRef: 'flow-abc',
        payload: { key: 'value' },
      }),
    );
  });

  it('records evidence when evidenceLog is provided', async () => {
    const { HashSha256: HashSha256Ctor } = await import('../../domain/primitives/index.js');
    type EvidenceLogPort = import('../ports/index.js').EvidenceLogPort;
    const appendEntry = vi.fn(async (_t: unknown, entry: unknown) => ({
      ...(entry as Record<string, unknown>),
      previousHash: HashSha256Ctor(''),
      hashSha256: HashSha256Ctor('abc'),
    }));
    const evidenceLog = { appendEntry } as unknown as EvidenceLogPort;

    const result = await executeApprovedAgentAction(
      { ...makeDeps(), evidenceLog },
      makeCtx(),
      makeInput(),
    );

    expect(result.ok).toBe(true);
    expect(appendEntry).toHaveBeenCalledTimes(1);
    const call = appendEntry.mock.calls[0]!;
    const entry = call[1] as Record<string, unknown>;
    expect(entry['category']).toBe('Action');
    expect((entry['summary'] as string)).toMatch(/executed/i);
  });
});
