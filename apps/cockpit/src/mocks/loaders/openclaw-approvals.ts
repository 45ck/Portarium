import type { ApprovalSummary } from '@portarium/cockpit-types';
import { APPROVALS } from '@/mocks/fixtures/openclaw-demo';

export function findOpenClawApproval(approvalIds: readonly string[]): ApprovalSummary | null {
  return APPROVALS.find((approval) => approvalIds.includes(approval.approvalId)) ?? null;
}
