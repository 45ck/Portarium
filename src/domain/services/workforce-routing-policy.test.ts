import { describe, expect, it } from 'vitest';

import {
  evaluateEscalationTriggers,
  hasApproverAssigneeSodViolation,
  hasCapabilityMismatch,
  missingRequiredCapabilities,
} from './workforce-routing-policy.js';

describe('workforce routing policy', () => {
  it('detects capability mismatches and returns missing capability list', () => {
    expect(hasCapabilityMismatch(['operations.approval'], ['operations.dispatch'])).toBe(true);
    expect(missingRequiredCapabilities(['operations.approval'], ['operations.dispatch'])).toEqual([
      'operations.approval',
    ]);
  });

  it('returns no capability mismatch when required capabilities are covered', () => {
    expect(
      hasCapabilityMismatch(
        ['operations.approval', 'operations.escalation'],
        ['operations.dispatch', 'operations.approval', 'operations.escalation'],
      ),
    ).toBe(false);
  });

  it('escalates when due date is exceeded and assignee is offline', () => {
    const reasons = evaluateEscalationTriggers({
      dueAtIso: '2026-02-20T10:00:00.000Z',
      nowIso: '2026-02-20T11:00:00.000Z',
      assigneeAvailabilityStatus: 'offline',
    });
    expect(reasons).toContain('due-date-exceeded');
    expect(reasons).toContain('assignee-offline');
  });

  it('flags SoD violation when approver and assignee are the same user', () => {
    expect(
      hasApproverAssigneeSodViolation({
        approverUserIds: ['user-approver-1', 'user-approver-2'],
        assigneeUserId: 'user-approver-2',
      }),
    ).toBe(true);
  });

  it('passes SoD when assignee is not one of approvers', () => {
    expect(
      hasApproverAssigneeSodViolation({
        approverUserIds: ['user-approver-1'],
        assigneeUserId: 'user-operator-1',
      }),
    ).toBe(false);
  });
});
