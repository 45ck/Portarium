import { describe, expect, it } from 'vitest';
import { parseApprovalNavigationTarget } from './approval-navigation';

describe('approval navigation targets', () => {
  it('maps native approval deep links into focused approval navigation', () => {
    expect(parseApprovalNavigationTarget('portarium://approvals/appr-123')).toEqual({
      to: '/approvals',
      search: { focus: 'appr-123', from: 'notification' },
    });
  });

  it('maps universal approval links into focused approval navigation', () => {
    expect(parseApprovalNavigationTarget('https://portarium.io/app/approvals/appr-456')).toEqual({
      to: '/approvals',
      search: { focus: 'appr-456', from: 'notification' },
    });
  });

  it('maps existing focused approval URLs into notification context', () => {
    expect(parseApprovalNavigationTarget('/approvals?focus=appr-789', 'https://app.test')).toEqual({
      to: '/approvals',
      search: { focus: 'appr-789', from: 'notification' },
    });
  });

  it('ignores links that do not identify an approval', () => {
    expect(parseApprovalNavigationTarget('/runs/run-1', 'https://app.test')).toBeNull();
  });
});
