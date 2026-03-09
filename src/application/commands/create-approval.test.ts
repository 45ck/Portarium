import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantId } from '../../domain/primitives/index.js';
import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import { HashSha256 } from '../../domain/primitives/index.js';
import type {
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdGenerator,
  UnitOfWork,
} from '../ports/index.js';
import { createApproval } from './create-approval.js';

const VALID_INPUT = {
  workspaceId: 'ws-1',
  runId: 'run-1',
  planId: 'plan-1',
  prompt: 'Please approve this run.',
} as const;

describe('createApproval', () => {
  let authorization: AuthorizationPort;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let approvalStore: ApprovalStore;
  let unitOfWork: UnitOfWork;
  let eventPublisher: EventPublisher;
  let evidenceLog: EvidenceLogPort;
  let idCounter: number;

  beforeEach(() => {
    idCounter = 0;
    authorization = { isAllowed: vi.fn(async () => true) };
    clock = { nowIso: vi.fn(() => '2026-03-09T10:00:00.000Z') };
    idGenerator = {
      generateId: vi.fn(() => {
        idCounter++;
        return `gen-${idCounter}`;
      }),
    };
    approvalStore = {
      getApprovalById: vi.fn(async () => null),
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

  it('creates a pending approval, saves it, and emits ApprovalRequested event', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      VALID_INPUT,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success response.');
    expect(result.value.status).toBe('Pending');
    expect(typeof result.value.approvalId).toBe('string');
    expect(approvalStore.saveApproval).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);

    const published = (eventPublisher.publish as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(published['type']).toBe('com.portarium.approval.ApprovalRequested');
  });

  it('rejects missing authorization', async () => {
    authorization.isAllowed = vi.fn(async () => false);
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['viewer'],
      }),
      VALID_INPUT,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected forbidden response.');
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.approvalCreate,
    );
  });

  it('rejects empty workspaceId', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { ...VALID_INPUT, workspaceId: '' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/workspaceId/i);
  });

  it('rejects empty runId', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { ...VALID_INPUT, runId: '' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/runId/i);
  });

  it('rejects empty planId', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { ...VALID_INPUT, planId: '' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/planId/i);
  });

  it('rejects empty prompt', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { ...VALID_INPUT, prompt: '' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/prompt/i);
  });

  it('rejects empty workItemId when provided', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { ...VALID_INPUT, workItemId: '' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/workItemId/i);
  });

  it('rejects empty assigneeUserId when provided', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { ...VALID_INPUT, assigneeUserId: '  ' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/assigneeUserId/i);
  });

  it('rejects invalid escalationChain step', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        ...VALID_INPUT,
        escalationChain: [{ stepOrder: 1, escalateToUserId: '', afterHours: 2 }],
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation error.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toMatch(/escalateToUserId/i);
  });

  it('rejects empty timestamp from clock', async () => {
    clock.nowIso = vi.fn(() => '');
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      VALID_INPUT,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected dependency failure.');
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('rejects empty generated approval identifier', async () => {
    idGenerator.generateId = vi.fn(() => '');
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      VALID_INPUT,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected dependency failure.');
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('creates approval with optional fields (workItemId, assigneeUserId, dueAtIso, escalationChain)', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        ...VALID_INPUT,
        workItemId: 'wi-1',
        assigneeUserId: 'user-2',
        dueAtIso: '2026-03-10T10:00:00.000Z',
        escalationChain: [
          { stepOrder: 1, escalateToUserId: 'user-3', afterHours: 4 },
          { stepOrder: 2, escalateToUserId: 'user-4', afterHours: 8 },
        ],
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success response.');
    expect(result.value.status).toBe('Pending');

    const savedApproval = (approvalStore.saveApproval as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as Record<string, unknown>;
    expect(savedApproval['workItemId']).toBeTruthy();
    expect(savedApproval['assigneeUserId']).toBeTruthy();
    expect(savedApproval['dueAtIso']).toBe('2026-03-10T10:00:00.000Z');
    expect(savedApproval['escalationChain']).toHaveLength(2);
  });

  it('records evidence when evidenceLog is provided', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher, evidenceLog },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      VALID_INPUT,
    );

    expect(result.ok).toBe(true);
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
    const call = (evidenceLog.appendEntry as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(call[0])).toBe('tenant-1');
    const entry = call[1] as Record<string, unknown>;
    expect(entry['category']).toBe('Approval');
    expect(entry['summary'] as string).toMatch(/requested/i);
  });

  it('succeeds without evidence when evidenceLog is not provided', async () => {
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      VALID_INPUT,
    );

    expect(result.ok).toBe(true);
  });

  it('returns DependencyFailure when unitOfWork throws', async () => {
    unitOfWork.execute = vi.fn(async () => {
      throw new Error('DB connection lost');
    });
    const result = await createApproval(
      { authorization, clock, idGenerator, approvalStore, unitOfWork, eventPublisher },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      VALID_INPUT,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected dependency failure.');
    expect(result.error.kind).toBe('DependencyFailure');
    expect(result.error.message).toMatch(/DB connection lost/i);
  });
});
