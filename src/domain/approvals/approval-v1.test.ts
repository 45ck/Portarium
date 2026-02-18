import { describe, expect, it } from 'vitest';

import { parseApprovalV1 } from './approval-v1.js';

describe('parseApprovalV1: happy path', () => {
  it('parses a minimal pending approval', () => {
    const approval = parseApprovalV1({
      schemaVersion: 1,
      approvalId: 'approval-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'Approve Plan P-1',
      requestedAtIso: '2026-02-17T00:00:00.000Z',
      requestedByUserId: 'user-1',
      status: 'Pending',
    });

    expect(approval.status).toBe('Pending');
  });

  it('parses an approved decision', () => {
    const approval = parseApprovalV1({
      schemaVersion: 1,
      approvalId: 'approval-2',
      workspaceId: 'ws-1',
      runId: 'run-2',
      planId: 'plan-2',
      workItemId: 'wi-1',
      prompt: 'Approve Plan P-2',
      requestedAtIso: '2026-02-17T00:00:00.000Z',
      requestedByUserId: 'user-1',
      assigneeUserId: 'user-2',
      dueAtIso: '2026-02-18T00:00:00.000Z',
      status: 'Approved',
      decidedAtIso: '2026-02-17T00:01:00.000Z',
      decidedByUserId: 'user-2',
      rationale: 'Looks correct.',
    });

    expect(approval.status).toBe('Approved');
    expect('rationale' in approval ? approval.rationale : undefined).toBe('Looks correct.');
  });
});

describe('parseApprovalV1: validation', () => {
  it('rejects invalid inputs and schema versions', () => {
    expect(() => parseApprovalV1('nope')).toThrow(/Approval must be an object/i);
    expect(() => parseApprovalV1({ schemaVersion: 2 })).toThrow(/schemaVersion/i);
  });

  it('rejects invalid status values', () => {
    expect(() =>
      parseApprovalV1({
        schemaVersion: 1,
        approvalId: 'approval-1',
        workspaceId: 'ws-1',
        runId: 'run-1',
        planId: 'plan-1',
        prompt: 'Approve Plan',
        requestedAtIso: '2026-02-17T00:00:00.000Z',
        requestedByUserId: 'user-1',
        status: 'Done',
      }),
    ).toThrow(/status/i);
  });

  it('requires decision fields when decided', () => {
    expect(() =>
      parseApprovalV1({
        schemaVersion: 1,
        approvalId: 'approval-2',
        workspaceId: 'ws-1',
        runId: 'run-1',
        planId: 'plan-1',
        prompt: 'Approve Plan',
        requestedAtIso: '2026-02-17T00:00:00.000Z',
        requestedByUserId: 'user-1',
        status: 'Denied',
      }),
    ).toThrow(/decidedAtIso/i);
  });

  it('rejects invalid requestedAtIso and dueAtIso formats', () => {
    expect(() =>
      parseApprovalV1({
        schemaVersion: 1,
        approvalId: 'approval-1',
        workspaceId: 'ws-1',
        runId: 'run-1',
        planId: 'plan-1',
        prompt: 'Approve Plan',
        requestedAtIso: 'not-a-date',
        requestedByUserId: 'user-1',
        status: 'Pending',
      }),
    ).toThrow(/requestedAtIso must be a valid ISO timestamp/);

    expect(() =>
      parseApprovalV1({
        schemaVersion: 1,
        approvalId: 'approval-2',
        workspaceId: 'ws-1',
        runId: 'run-2',
        planId: 'plan-2',
        prompt: 'Approve Plan',
        requestedAtIso: '2026-02-17T00:00:00.000Z',
        requestedByUserId: 'user-1',
        dueAtIso: 'not-a-date',
        status: 'Pending',
      }),
    ).toThrow(/dueAtIso must be a valid ISO timestamp/);
  });

  it('rejects decision and due dates that precede requestedAtIso', () => {
    expect(() =>
      parseApprovalV1({
        schemaVersion: 1,
        approvalId: 'approval-3',
        workspaceId: 'ws-1',
        runId: 'run-3',
        planId: 'plan-3',
        prompt: 'Approve Plan',
        requestedAtIso: '2026-02-17T00:00:00.000Z',
        requestedByUserId: 'user-1',
        dueAtIso: '2026-02-16T00:00:00.000Z',
        status: 'Pending',
      }),
    ).toThrow(/dueAtIso must not precede requestedAtIso/);

    expect(() =>
      parseApprovalV1({
        schemaVersion: 1,
        approvalId: 'approval-4',
        workspaceId: 'ws-1',
        runId: 'run-4',
        planId: 'plan-4',
        prompt: 'Approve Plan',
        requestedAtIso: '2026-02-17T00:00:00.000Z',
        requestedByUserId: 'user-1',
        status: 'Denied',
        decidedAtIso: '2026-02-16T00:00:00.000Z',
        decidedByUserId: 'user-2',
        rationale: 'Out of order',
      }),
    ).toThrow(/decidedAtIso must not precede requestedAtIso/);
  });

  it('rejects decision fields on pending approvals', () => {
    const base = {
      schemaVersion: 1,
      approvalId: 'approval-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'Approve Plan',
      requestedAtIso: '2026-02-17T00:00:00.000Z',
      requestedByUserId: 'user-1',
      status: 'Pending',
    };

    expect(() => parseApprovalV1({ ...base, decidedAtIso: '2026-02-17T00:01:00.000Z' })).toThrow(
      /decision fields/i,
    );

    expect(() => parseApprovalV1({ ...base, decidedByUserId: 'user-2' })).toThrow(
      /decision fields/i,
    );

    expect(() => parseApprovalV1({ ...base, rationale: 'should not be here' })).toThrow(
      /decision fields/i,
    );
  });

  it('parses an approval with escalation chain', () => {
    const approval = parseApprovalV1({
      schemaVersion: 1,
      approvalId: 'approval-5',
      workspaceId: 'ws-1',
      runId: 'run-5',
      planId: 'plan-5',
      prompt: 'Approve Plan',
      requestedAtIso: '2026-02-17T00:00:00.000Z',
      requestedByUserId: 'user-1',
      status: 'Pending',
      escalationChain: [{ stepOrder: 1, escalateToUserId: 'mgr-1', afterHours: 24 }],
    });
    expect(approval.escalationChain).toHaveLength(1);
  });

  it('rejects invalid escalation chain entries', () => {
    expect(() =>
      parseApprovalV1({
        schemaVersion: 1,
        approvalId: 'approval-6',
        workspaceId: 'ws-1',
        runId: 'run-6',
        planId: 'plan-6',
        prompt: 'Approve Plan',
        requestedAtIso: '2026-02-17T00:00:00.000Z',
        requestedByUserId: 'user-1',
        status: 'Pending',
        escalationChain: ['bad-step'],
      }),
    ).toThrow(/escalationChain\[0\] must be an object/i);

    expect(() =>
      parseApprovalV1({
        schemaVersion: 1,
        approvalId: 'approval-7',
        workspaceId: 'ws-1',
        runId: 'run-7',
        planId: 'plan-7',
        prompt: 'Approve Plan',
        requestedAtIso: '2026-02-17T00:00:00.000Z',
        requestedByUserId: 'user-1',
        status: 'Pending',
        escalationChain: 'not-an-array',
      }),
    ).toThrow(/escalationChain must be an array/i);
  });
});
