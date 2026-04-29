import type { TriageAction } from './triage-card';

export const TRIAGE_COMMIT_PX = 120;
export const TRIAGE_COMMIT_VELOCITY = 500;

export type TriageDragDecision =
  | { kind: 'snap-back' }
  | { kind: 'reject'; reason: 'approve' | 'deny' }
  | { kind: 'commit'; direction: 1 | -1; action: TriageAction; rationale: string };

export function resolveTriageDragDecision(input: {
  offsetX: number;
  velocityX: number;
  canApprove: boolean;
  canDeny: boolean;
  currentRationale: string;
}): TriageDragDecision {
  const committed =
    Math.abs(input.offsetX) >= TRIAGE_COMMIT_PX ||
    Math.abs(input.velocityX) >= TRIAGE_COMMIT_VELOCITY;

  if (!committed) return { kind: 'snap-back' };

  const direction = input.offsetX > 0 ? 1 : -1;
  const action: TriageAction = direction > 0 ? 'Approved' : 'Denied';

  if (action === 'Approved' && !input.canApprove) {
    return { kind: 'reject', reason: 'approve' };
  }
  if (action === 'Denied' && !input.canDeny) {
    return { kind: 'reject', reason: 'deny' };
  }

  return { kind: 'commit', direction, action, rationale: input.currentRationale };
}
