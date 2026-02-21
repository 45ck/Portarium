import type { ApprovalSummary, EvidenceEntry, RunSummary } from '@portarium/cockpit-types';

export interface PolicyPanelSummary {
  tierLabel: string;
  triggerLabel: string;
  irreversibilityLabel: string;
  sodLabel: string;
}

export interface EvidencePanelSummary {
  entryCount: number;
  attachmentCount: number;
  chainStatus: 'none' | 'verified' | 'broken';
  latestOccurredAtIso?: string;
}

export interface RunTimelinePanelSummary {
  runStatusLabel: string;
  executionTierLabel: string;
  cycleCount: number;
  isOverdue: boolean;
}

function formatIrreversibility(irreversibility?: 'full' | 'partial' | 'none'): string {
  if (irreversibility === 'full') return 'Fully irreversible';
  if (irreversibility === 'partial') return 'Partially reversible';
  if (irreversibility === 'none') return 'Reversible';
  return 'Not specified';
}

function formatSodState(
  state?: ApprovalSummary['sodEvaluation'] extends infer T
    ? T extends { state: infer S }
      ? S
      : never
    : never,
): string {
  if (!state) return 'No SoD constraints';
  if (state === 'eligible') return 'Eligible';
  if (state === 'blocked-self') return 'Blocked: requestor cannot self-approve';
  if (state === 'blocked-role') return 'Blocked: missing required role';
  return 'N-of-M review in progress';
}

function detectChainBreak(entries: readonly EvidenceEntry[]): boolean {
  if (entries.length < 2) return false;
  const sorted = [...entries].sort(
    (a, b) => new Date(a.occurredAtIso).getTime() - new Date(b.occurredAtIso).getTime(),
  );
  for (let i = 1; i < sorted.length; i += 1) {
    const entry = sorted[i]!;
    const prev = sorted[i - 1]!;
    if (entry.previousHash !== prev.hashSha256) return true;
  }
  return false;
}

export function buildPolicyPanelSummary(approval: ApprovalSummary): PolicyPanelSummary {
  const rule = approval.policyRule;
  return {
    tierLabel: rule?.tier ?? 'Not tiered',
    triggerLabel: rule?.trigger ?? 'No explicit trigger',
    irreversibilityLabel: formatIrreversibility(rule?.irreversibility),
    sodLabel: formatSodState(approval.sodEvaluation?.state),
  };
}

export function buildEvidencePanelSummary(entries: readonly EvidenceEntry[]): EvidencePanelSummary {
  if (entries.length === 0) {
    return {
      entryCount: 0,
      attachmentCount: 0,
      chainStatus: 'none',
    };
  }

  const attachmentCount = entries.reduce((sum, item) => sum + (item.payloadRefs?.length ?? 0), 0);
  const latestOccurredAtIso = [...entries].sort(
    (a, b) => new Date(b.occurredAtIso).getTime() - new Date(a.occurredAtIso).getTime(),
  )[0]?.occurredAtIso;

  return {
    entryCount: entries.length,
    attachmentCount,
    chainStatus: detectChainBreak(entries) ? 'broken' : 'verified',
    latestOccurredAtIso,
  };
}

export function buildRunTimelinePanelSummary(
  approval: ApprovalSummary,
  run?: RunSummary,
): RunTimelinePanelSummary {
  const cycleCount = (approval.decisionHistory ?? []).filter(
    (entry) => entry.type === 'changes_requested' || entry.type === 'resubmitted',
  ).length;
  const isOverdue = Boolean(
    approval.dueAtIso && new Date(approval.dueAtIso).getTime() < Date.now(),
  );

  return {
    runStatusLabel: run?.status ?? 'WaitingForApproval',
    executionTierLabel: run?.executionTier ?? approval.policyRule?.tier ?? 'Not specified',
    cycleCount,
    isOverdue,
  };
}
