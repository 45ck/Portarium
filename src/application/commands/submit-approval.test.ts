import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantId } from '../../domain/primitives/index.js';
import { parseApprovalV1 } from '../../domain/approvals/approval-v1.js';
import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import {
  type ApprovalStore,
  type AuthorizationPort,
  type Clock,
  type EventPublisher,
  type IdGenerator,
  type UnitOfWork,
} from '../ports/index.js';
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

describe('submitApproval', () => {
  let authorization: AuthorizationPort;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let approvalStore: ApprovalStore;
  let unitOfWork: UnitOfWork;
  let eventPublisher: EventPublisher;

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

  it('rejects request-changes decision at command boundary', async () => {
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

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation-failed response.');
    }
    expect(result.error.kind).toBe('ValidationFailed');
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
});
