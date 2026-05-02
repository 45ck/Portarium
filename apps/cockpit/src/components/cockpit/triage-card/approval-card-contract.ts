import type {
  ApprovalSummary,
  EvidenceEntry,
  PlanEffect,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { hasChainBreak } from '@/components/cockpit/triage-modes/lib/chain-verification';

export const APPROVAL_CARD_CONTRACT_NAME = 'ApprovalCardReviewDepthV1';

export type ApprovalCardRiskTier = 'low' | 'elevated' | 'high';
export type ApprovalCardReviewDepth = 'fast-triage' | 'deep-review' | 'escalation-lock';

export interface ApprovalCardFriction {
  requireExpansion: boolean;
  requireRationale: boolean;
  requireSecondConfirm: boolean;
  escalationLock: boolean;
  lockReason?: string;
}

export interface ApprovalCardField {
  label: string;
  value: string;
  evidenceSource: 'ApprovalSummary' | 'Plan' | 'Evidence' | 'Run' | 'Workflow' | 'Derived';
}

export interface ApprovalCardContract {
  contractName: typeof APPROVAL_CARD_CONTRACT_NAME;
  riskTier: ApprovalCardRiskTier;
  reviewDepth: ApprovalCardReviewDepth;
  fields: {
    proposedAction: ApprovalCardField;
    intent: ApprovalCardField;
    systemsTouched: ApprovalCardField;
    policyResult: ApprovalCardField;
    blastRadius: ApprovalCardField;
    reversibility: ApprovalCardField;
    evidence: ApprovalCardField;
    rationale: ApprovalCardField;
    priorRelatedActions: ApprovalCardField;
  };
  friction: ApprovalCardFriction;
  escalationReasons: string[];
}

interface BuildApprovalCardContractInput {
  approval: ApprovalSummary;
  plannedEffects: readonly PlanEffect[];
  evidenceEntries: readonly EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function compactList(values: readonly string[], empty: string): string {
  const list = unique(values);
  return list.length > 0 ? list.join(', ') : empty;
}

function policySystems(approval: ApprovalSummary): string[] {
  return (approval.policyRule?.blastRadius ?? []).filter((item) => !/\brecords?\b/i.test(item));
}

function parsePolicyRecordCount(approval: ApprovalSummary): number | undefined {
  for (const item of approval.policyRule?.blastRadius ?? []) {
    const match = /(\d[\d,]*)\s+records?/i.exec(item);
    if (match?.[1]) return Number.parseInt(match[1].replaceAll(',', ''), 10);
  }
  return undefined;
}

function isManualOnly(approval: ApprovalSummary, run?: RunSummary): boolean {
  return approval.policyRule?.tier === 'ManualOnly' || run?.executionTier === 'ManualOnly';
}

function isHumanApprove(approval: ApprovalSummary, run?: RunSummary): boolean {
  return approval.policyRule?.tier === 'HumanApprove' || run?.executionTier === 'HumanApprove';
}

function isSodBlocked(approval: ApprovalSummary): boolean {
  const state = approval.sodEvaluation?.state;
  return state === 'blocked-self' || state === 'blocked-role';
}

function describeProposedAction(approval: ApprovalSummary, effects: readonly PlanEffect[]): string {
  if (effects.length > 0) {
    const first = effects[0]!;
    const target = first.target.displayLabel ?? first.target.externalType;
    const prefix = effects.length === 1 ? first.operation : `${effects.length} planned effects`;
    return `${prefix}: ${first.summary} (${target} in ${first.target.sorName})`;
  }

  if (approval.agentActionProposal) {
    return `${approval.agentActionProposal.toolName} via ${approval.agentActionProposal.agentId}`;
  }

  return approval.prompt;
}

function describeEvidence(entries: readonly EvidenceEntry[]): string {
  if (entries.length === 0) return 'No linked evidence entries';
  if (hasChainBreak([...entries])) return `${entries.length} entries; chain integrity warning`;

  const attachmentCount = entries.reduce((sum, entry) => sum + (entry.payloadRefs?.length ?? 0), 0);
  const suffix = attachmentCount > 0 ? `, ${attachmentCount} attachment(s)` : '';
  return `${entries.length} entries; chain verified${suffix}`;
}

function describePriorRelatedActions(
  approval: ApprovalSummary,
  entries: readonly EvidenceEntry[],
): string {
  const actionEvidence = entries
    .filter((entry) => entry.category === 'Action')
    .slice(-3)
    .map((entry) => entry.summary);
  const history = (approval.decisionHistory ?? [])
    .filter((entry) => entry.type !== 'requested')
    .slice(-2)
    .map((entry) => `${entry.type}: ${entry.message}`);

  return compactList([...actionEvidence, ...history], 'No prior related Actions found');
}

function describePolicyResult(approval: ApprovalSummary, run?: RunSummary): string {
  const tier = approval.policyRule?.tier ?? run?.executionTier ?? 'No policy tier available';
  const trigger = approval.policyRule?.trigger ? ` via ${approval.policyRule.trigger}` : '';
  const sod = approval.sodEvaluation?.state ? `; SoD ${approval.sodEvaluation.state}` : '';
  return `${tier}${trigger}${sod}`;
}

function describeReversibility(approval: ApprovalSummary): string {
  const irreversibility = approval.policyRule?.irreversibility;
  if (irreversibility === 'full') return 'Irreversible';
  if (irreversibility === 'partial') return 'Partially reversible';
  if (irreversibility === 'none') return 'Reversible';
  return 'No reversibility declared';
}

function describeBlastRadius(approval: ApprovalSummary, effects: readonly PlanEffect[]): string {
  const recordCount = parsePolicyRecordCount(approval) ?? effects.length;
  const systems = compactList(
    [...effects.map((effect) => effect.target.sorName), ...policySystems(approval)],
    'No external system declared',
  );
  return `${systems}; ${recordCount} planned record${recordCount === 1 ? '' : 's'}`;
}

function collectEscalationReasons(input: BuildApprovalCardContractInput): string[] {
  const { approval, plannedEffects, evidenceEntries, run } = input;
  const reasons: string[] = [];
  const systemCount = unique([
    ...plannedEffects.map((effect) => effect.target.sorName),
    ...policySystems(approval),
  ]).length;
  const recordCount = parsePolicyRecordCount(approval) ?? plannedEffects.length;

  if (isSodBlocked(approval)) reasons.push('SoD blocks this approver');
  if (isManualOnly(approval, run)) reasons.push('Manual-only policy or Run tier');
  if (isHumanApprove(approval, run)) reasons.push('Human-approve policy or Run tier');
  if (approval.policyRule?.irreversibility === 'full') reasons.push('Irreversible Action');
  if (approval.policyRule?.irreversibility === 'partial')
    reasons.push('Partially reversible Action');
  if (plannedEffects.some((effect) => effect.operation === 'Delete')) reasons.push('Delete effect');
  if (approval.agentActionProposal?.toolCategory === 'Dangerous') reasons.push('Dangerous tool');
  if (systemCount > 1) reasons.push('Multiple systems touched');
  if (recordCount > 3) reasons.push('Multiple records affected');
  if (evidenceEntries.length === 0) reasons.push('No linked evidence');
  if (hasChainBreak([...evidenceEntries])) reasons.push('Evidence chain warning');

  return unique(reasons);
}

function classifyRisk(
  approval: ApprovalSummary,
  reasons: readonly string[],
  run?: RunSummary,
): ApprovalCardRiskTier {
  if (
    isManualOnly(approval, run) ||
    approval.policyRule?.irreversibility === 'full' ||
    approval.agentActionProposal?.toolCategory === 'Dangerous' ||
    reasons.includes('Delete effect') ||
    reasons.includes('Evidence chain warning')
  ) {
    return 'high';
  }

  if (reasons.length > 0) return 'elevated';
  return 'low';
}

function buildFriction(
  approval: ApprovalSummary,
  riskTier: ApprovalCardRiskTier,
  run?: RunSummary,
): ApprovalCardFriction {
  if (isSodBlocked(approval)) {
    return {
      requireExpansion: true,
      requireRationale: true,
      requireSecondConfirm: false,
      escalationLock: true,
      lockReason:
        approval.sodEvaluation?.state === 'blocked-self'
          ? 'You cannot approve your own request'
          : 'Missing required approval role',
    };
  }

  if (isManualOnly(approval, run)) {
    return {
      requireExpansion: true,
      requireRationale: true,
      requireSecondConfirm: false,
      escalationLock: true,
      lockReason: 'Manual-only Actions must be escalated or completed outside approve flow',
    };
  }

  if (riskTier === 'high') {
    return {
      requireExpansion: true,
      requireRationale: true,
      requireSecondConfirm: true,
      escalationLock: false,
    };
  }

  return {
    requireExpansion: riskTier === 'elevated',
    requireRationale: false,
    requireSecondConfirm: false,
    escalationLock: false,
  };
}

export function buildApprovalCardContract(
  input: BuildApprovalCardContractInput,
): ApprovalCardContract {
  const { approval, plannedEffects, evidenceEntries, run, workflow } = input;
  const reasons = collectEscalationReasons(input);
  const riskTier = classifyRisk(approval, reasons, run);
  const friction = buildFriction(approval, riskTier, run);
  const reviewDepth: ApprovalCardReviewDepth = friction.escalationLock
    ? 'escalation-lock'
    : riskTier === 'low'
      ? 'fast-triage'
      : 'deep-review';
  const systemsTouched = compactList(
    [
      ...plannedEffects.map((effect) => effect.target.sorName),
      ...policySystems(approval),
      ...(workflow?.actions.map((action) => action.portFamily) ?? []),
    ],
    'No external system declared',
  );

  return {
    contractName: APPROVAL_CARD_CONTRACT_NAME,
    riskTier,
    reviewDepth,
    fields: {
      proposedAction: {
        label: 'Proposed Action',
        value: describeProposedAction(approval, plannedEffects),
        evidenceSource: plannedEffects.length > 0 ? 'Plan' : 'ApprovalSummary',
      },
      intent: {
        label: 'Goal or intent',
        value: workflow?.description ?? workflow?.name ?? approval.prompt,
        evidenceSource: workflow ? 'Workflow' : 'ApprovalSummary',
      },
      systemsTouched: {
        label: 'Systems touched',
        value: systemsTouched,
        evidenceSource: 'Derived',
      },
      policyResult: {
        label: 'Policy result',
        value: describePolicyResult(approval, run),
        evidenceSource: approval.policyRule ? 'ApprovalSummary' : 'Run',
      },
      blastRadius: {
        label: 'Blast radius',
        value: describeBlastRadius(approval, plannedEffects),
        evidenceSource: 'Derived',
      },
      reversibility: {
        label: 'Reversibility',
        value: describeReversibility(approval),
        evidenceSource: 'ApprovalSummary',
      },
      evidence: {
        label: 'Evidence',
        value: describeEvidence(evidenceEntries),
        evidenceSource: 'Evidence',
      },
      rationale: {
        label: 'Rationale',
        value:
          approval.agentActionProposal?.rationale ??
          approval.rationale ??
          'No rationale supplied with this Approval Gate',
        evidenceSource: approval.agentActionProposal ? 'ApprovalSummary' : 'ApprovalSummary',
      },
      priorRelatedActions: {
        label: 'Prior related Actions',
        value: describePriorRelatedActions(approval, evidenceEntries),
        evidenceSource: 'Derived',
      },
    },
    friction,
    escalationReasons: reasons,
  };
}
