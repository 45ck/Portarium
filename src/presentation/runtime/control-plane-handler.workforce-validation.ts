import type { WorkforceAvailabilityStatus } from './control-plane-handler.shared.js';

export const VALID_TASK_STATUSES = new Set([
  'pending',
  'assigned',
  'in-progress',
  'completed',
  'escalated',
]);

export const VALID_EVIDENCE_CATEGORIES = new Set([
  'Plan',
  'Action',
  'Approval',
  'Policy',
  'System',
]);

export function parseAvailabilityPatchBody(
  value: unknown,
): { ok: true; availabilityStatus: WorkforceAvailabilityStatus } | { ok: false } {
  if (typeof value !== 'object' || value === null) return { ok: false };
  const record = value as { availabilityStatus?: unknown };
  if (
    record.availabilityStatus === 'available' ||
    record.availabilityStatus === 'busy' ||
    record.availabilityStatus === 'offline'
  ) {
    return { ok: true, availabilityStatus: record.availabilityStatus };
  }
  return { ok: false };
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed !== '' ? trimmed : undefined;
}

export function parseAssignHumanTaskBody(
  value: unknown,
): { ok: true; workforceMemberId?: string; workforceQueueId?: string } | { ok: false } {
  if (typeof value !== 'object' || value === null) return { ok: false };
  const record = value as { workforceMemberId?: unknown; workforceQueueId?: unknown };
  const workforceMemberId = readOptionalString(record.workforceMemberId);
  const workforceQueueId = readOptionalString(record.workforceQueueId);
  if (!workforceMemberId && !workforceQueueId) return { ok: false };
  return {
    ok: true,
    ...(workforceMemberId ? { workforceMemberId } : {}),
    ...(workforceQueueId ? { workforceQueueId } : {}),
  };
}

export function parseCompleteHumanTaskBody(
  value: unknown,
): { ok: true; completionNote?: string } | { ok: false } {
  if (value === null) return { ok: true };
  if (typeof value !== 'object') return { ok: false };
  const record = value as { completionNote?: unknown };
  const completionNote =
    typeof record.completionNote === 'string' && record.completionNote.trim() !== ''
      ? record.completionNote.trim()
      : undefined;
  return { ok: true, ...(completionNote ? { completionNote } : {}) };
}

export function parseEscalateHumanTaskBody(
  value: unknown,
): { ok: true; workforceQueueId: string; reason?: string } | { ok: false } {
  if (typeof value !== 'object' || value === null) return { ok: false };
  const record = value as { workforceQueueId?: unknown; reason?: unknown };
  if (typeof record.workforceQueueId !== 'string' || record.workforceQueueId.trim() === '')
    return { ok: false };
  const reason =
    typeof record.reason === 'string' && record.reason.trim() !== ''
      ? record.reason.trim()
      : undefined;
  return {
    ok: true,
    workforceQueueId: record.workforceQueueId.trim(),
    ...(reason ? { reason } : {}),
  };
}
