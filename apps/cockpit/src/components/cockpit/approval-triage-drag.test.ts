import { describe, expect, it } from 'vitest';
import { resolveTriageDragDecision, TRIAGE_COMMIT_PX } from './approval-triage-drag';

describe('resolveTriageDragDecision', () => {
  it('snaps back below distance and velocity thresholds', () => {
    expect(
      resolveTriageDragDecision({
        offsetX: TRIAGE_COMMIT_PX - 1,
        velocityX: 100,
        canApprove: true,
        canDeny: true,
        currentRationale: '',
      }),
    ).toEqual({ kind: 'snap-back' });
  });

  it('commits right drag as approval', () => {
    expect(
      resolveTriageDragDecision({
        offsetX: TRIAGE_COMMIT_PX,
        velocityX: 0,
        canApprove: true,
        canDeny: true,
        currentRationale: 'safe',
      }),
    ).toEqual({ kind: 'commit', direction: 1, action: 'Approved', rationale: 'safe' });
  });

  it('commits left flick as denial when rationale is valid', () => {
    expect(
      resolveTriageDragDecision({
        offsetX: -10,
        velocityX: -600,
        canApprove: true,
        canDeny: true,
        currentRationale: 'too risky',
      }),
    ).toEqual({ kind: 'commit', direction: -1, action: 'Denied', rationale: 'too risky' });
  });

  it('rejects blocked approvals', () => {
    expect(
      resolveTriageDragDecision({
        offsetX: TRIAGE_COMMIT_PX,
        velocityX: 0,
        canApprove: false,
        canDeny: true,
        currentRationale: '',
      }),
    ).toEqual({ kind: 'reject', reason: 'approve' });
  });

  it('rejects denial without required rationale', () => {
    expect(
      resolveTriageDragDecision({
        offsetX: -TRIAGE_COMMIT_PX,
        velocityX: 0,
        canApprove: true,
        canDeny: false,
        currentRationale: '',
      }),
    ).toEqual({ kind: 'reject', reason: 'deny' });
  });
});
