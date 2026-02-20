import type { WorkforceAvailabilityStatus } from '../workforce/workforce-member-v1.js';

export type WorkforceEscalationReason = 'due-date-exceeded' | 'assignee-offline';

export function missingRequiredCapabilities(
  requiredCapabilities: readonly string[],
  memberCapabilities: readonly string[],
): readonly string[] {
  return requiredCapabilities.filter((capability) => !memberCapabilities.includes(capability));
}

export function hasCapabilityMismatch(
  requiredCapabilities: readonly string[],
  memberCapabilities: readonly string[],
): boolean {
  return missingRequiredCapabilities(requiredCapabilities, memberCapabilities).length > 0;
}

export function evaluateEscalationTriggers(
  input: Readonly<{
    dueAtIso?: string;
    nowIso: string;
    assigneeAvailabilityStatus?: WorkforceAvailabilityStatus;
  }>,
): readonly WorkforceEscalationReason[] {
  const reasons: WorkforceEscalationReason[] = [];

  if (input.assigneeAvailabilityStatus === 'offline') {
    reasons.push('assignee-offline');
  }

  if (input.dueAtIso) {
    const dueAtMs = Date.parse(input.dueAtIso);
    const nowMs = Date.parse(input.nowIso);
    if (Number.isFinite(dueAtMs) && Number.isFinite(nowMs) && nowMs > dueAtMs) {
      reasons.push('due-date-exceeded');
    }
  }

  return reasons;
}

export function hasApproverAssigneeSodViolation(
  input: Readonly<{
    approverUserIds: readonly string[];
    assigneeUserId?: string;
  }>,
): boolean {
  if (!input.assigneeUserId) return false;
  return input.approverUserIds.includes(input.assigneeUserId);
}
