import type {
  ApprovalSummary,
  EvidenceEntry,
  PlanEffect,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { hasChainBreak } from '@/components/cockpit/triage-modes/lib/chain-verification';

export const APPROVAL_CARD_CONTRACT_NAME = 'ApprovalCardReviewDepthV1';
const MONITOR_ATTENTION_FALLBACK = 'Review monitor attention item';

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
  evidenceSource:
    | 'ApprovalSummary'
    | 'ApprovalPacket'
    | 'Plan'
    | 'Evidence'
    | 'Run'
    | 'Workflow'
    | 'Derived';
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

function textFromUnknown(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => textFromUnknown(item)).filter(Boolean).join(', ') || fallback;
  }
  if (typeof value !== 'object') return fallback;

  const record = value as Record<string, unknown>;
  for (const key of [
    'label',
    'title',
    'displayLabel',
    'name',
    'summary',
    'description',
    'reason',
    'requiredAction',
    'intent',
  ]) {
    const text = textFromUnknown(record[key]);
    if (text) return text;
  }

  const profileId = textFromUnknown(record.profileId ?? record.profile_id);
  const source = textFromUnknown(record.source);
  if (profileId && source) return `${profileId}:${source}`;
  if (source) return source;
  if (profileId) return profileId;

  return textFromUnknown(record.id ?? record.approvalId ?? record.proposalId, fallback);
}

function removeObjectPlaceholders(value: string): string {
  return value
    .replace(/\[object Object\]/gi, '')
    .replace(/\s+([.;,:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMissingObjectLabel(value: string): boolean {
  return /\[object Object\]/i.test(value) || removeObjectPlaceholders(value).length === 0;
}

function compactText(value: unknown, maxLength: number): string {
  const text = removeObjectPlaceholders(textFromUnknown(value).replace(/\s+/g, ' ').trim());
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function normalizedText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameMeaning(left: string, right: string): boolean {
  return normalizedText(left) === normalizedText(right);
}

export function summarizeApprovalPrompt(value: unknown, maxLength = 180): string {
  const text = textFromUnknown(value).replace(/\s+/g, ' ').trim();
  const monitorMatch = /Review latest standing-read monitor attention item:\s*([^.;]+)/i.exec(text);
  if (monitorMatch?.[1]) {
    if (isMissingObjectLabel(monitorMatch[1])) return MONITOR_ATTENTION_FALLBACK;
    return compactText(`Review monitor item: ${monitorMatch[1]}`, maxLength);
  }

  const legacyMonitorMatch = /Review monitor item:\s*([^.;]+)/i.exec(text);
  if (legacyMonitorMatch?.[1]) {
    if (isMissingObjectLabel(legacyMonitorMatch[1])) return MONITOR_ATTENTION_FALLBACK;
    return compactText(`Review monitor item: ${legacyMonitorMatch[1]}`, maxLength);
  }

  const openClawMatch = /^OpenClaw approval required:\s*([^.;]+)/i.exec(text);
  if (openClawMatch?.[1]) {
    return compactText(`OpenClaw approval: ${openClawMatch[1]}`, maxLength);
  }

  return compactText(text, maxLength);
}

function approvalPacketPlanSummary(approval: ApprovalSummary): string | undefined {
  const summary = approval.approvalPacket?.planScope?.summary?.trim();
  return summary ? summarizeApprovalPrompt(summary, 240) : undefined;
}

export function summarizeApprovalTitle(approval: ApprovalSummary, maxLength = 180): string {
  const prompt = summarizeApprovalPrompt(approval.prompt, maxLength);
  if (prompt !== MONITOR_ATTENTION_FALLBACK) return prompt;

  const packetSummary = approvalPacketPlanSummary(approval);
  if (packetSummary && packetSummary !== MONITOR_ATTENTION_FALLBACK) {
    return compactText(packetSummary, maxLength);
  }

  return prompt;
}

function policySystems(approval: ApprovalSummary): string[] {
  return (approval.policyRule?.blastRadius ?? []).filter((item) => !/\brecords?\b/i.test(item));
}

function approvalPacketSystems(approval: ApprovalSummary): string[] {
  const packet = approval.approvalPacket;
  if (!packet) return [];

  const artifactSystems = (packet.artifacts ?? [])
    .map((artifact) => {
      const family = artifact.sourceFamily?.trim();
      const sourceId = artifact.sourceId?.trim();
      if (family && sourceId) return `${family}:${sourceId}`;
      return family || sourceId || '';
    })
    .filter(Boolean);

  const capabilities = (packet.requestedCapabilities ?? []).map((capability) =>
    capability.capabilityId.trim(),
  );

  return unique([...artifactSystems, ...capabilities]);
}

function approvalPacketPlannedCounts(approval: ApprovalSummary): {
  actionCount: number;
  effectCount: number;
} {
  const scope = approval.approvalPacket?.planScope;
  return {
    actionCount: scope?.actionIds?.length ?? 0,
    effectCount: scope?.plannedEffectIds?.length ?? 0,
  };
}

function approvalPacketPrimaryCapability(approval: ApprovalSummary): string | undefined {
  const capability =
    approval.approvalPacket?.requestedCapabilities?.find((item) => item.required) ??
    approval.approvalPacket?.requestedCapabilities?.[0];
  return capability?.capabilityId?.trim() || undefined;
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

  return summarizeApprovalPrompt(approval.prompt);
}

function describeIntent(
  approval: ApprovalSummary,
  workflow: WorkflowSummary | undefined,
  proposedAction: string,
): { value: string; evidenceSource: ApprovalCardField['evidenceSource'] } {
  const workflowIntent = workflow?.description ?? workflow?.name;
  if (workflowIntent) {
    return { value: workflowIntent, evidenceSource: 'Workflow' };
  }

  const packetSummary = approvalPacketPlanSummary(approval);
  if (packetSummary && !sameMeaning(packetSummary, proposedAction)) {
    return { value: packetSummary, evidenceSource: 'ApprovalPacket' };
  }

  if (approval.approvalPacket) {
    return {
      value: 'Review packet scope and decide operator intent only.',
      evidenceSource: 'ApprovalPacket',
    };
  }

  return { value: summarizeApprovalPrompt(approval.prompt), evidenceSource: 'ApprovalSummary' };
}

function describeEvidence(entries: readonly EvidenceEntry[], approval: ApprovalSummary): string {
  if (entries.length === 0) {
    const packetArtifacts =
      approval.approvalPacket?.artifacts?.filter((artifact) => artifact.role !== 'primary') ?? [];
    const visualTimelineCount = approval.approvalPacket?.visualEvidenceTimeline?.length ?? 0;
    if (packetArtifacts.length > 0 || visualTimelineCount > 0) {
      return `${packetArtifacts.length} packet artifact(s); ${visualTimelineCount} visual timeline item(s)`;
    }
    return 'No linked evidence entries';
  }
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

function describeRationale(approval: ApprovalSummary): string {
  const rationale =
    approval.agentActionProposal?.rationale ??
    approval.rationale ??
    approval.approvalPacket?.operatorBrief?.recommendation ??
    approval.approvalPacket?.operatorBrief?.whyGated ??
    'No rationale supplied with this Approval Gate';
  return summarizeApprovalPrompt(rationale, 240);
}

function describePolicyResult(approval: ApprovalSummary, run?: RunSummary): string {
  const tier = approval.policyRule?.tier ?? run?.executionTier;
  if (!tier && approval.approvalPacket) {
    const authority = approval.approvalPacket.operatorBrief?.authority?.trim();
    if (authority) return `Approval packet authority: ${authority}`;

    const capability = approvalPacketPrimaryCapability(approval);
    if (capability) return `Approval packet requires ${capability}`;
  }

  const resultTier = tier ?? 'No policy tier available';
  const trigger = approval.policyRule?.trigger ? ` via ${approval.policyRule.trigger}` : '';
  const sod = approval.sodEvaluation?.state ? `; SoD ${approval.sodEvaluation.state}` : '';
  return `${resultTier}${trigger}${sod}`;
}

function describeReversibility(approval: ApprovalSummary): string {
  const irreversibility = approval.policyRule?.irreversibility;
  if (irreversibility === 'full') return 'Irreversible';
  if (irreversibility === 'partial') return 'Partially reversible';
  if (irreversibility === 'none') return 'Reversible';

  const rollback = approval.approvalPacket?.operatorBrief?.rollback?.trim();
  if (rollback) return `Stop path: ${compactText(rollback, 160)}`;

  return 'No reversibility declared';
}

function describeBlastRadius(approval: ApprovalSummary, effects: readonly PlanEffect[]): string {
  const recordCount = parsePolicyRecordCount(approval) ?? effects.length;
  const packetCounts = approvalPacketPlannedCounts(approval);
  const systems = compactList(
    [
      ...effects.map((effect) => effect.target.sorName),
      ...policySystems(approval),
      ...approvalPacketSystems(approval),
    ],
    'No external system declared',
  );

  if (recordCount === 0 && (packetCounts.actionCount > 0 || packetCounts.effectCount > 0)) {
    return `${systems}; ${packetCounts.actionCount} planned Action${
      packetCounts.actionCount === 1 ? '' : 's'
    }, ${packetCounts.effectCount} planned effect${packetCounts.effectCount === 1 ? '' : 's'}`;
  }

  return `${systems}; ${recordCount} planned record${recordCount === 1 ? '' : 's'}`;
}

function collectEscalationReasons(input: BuildApprovalCardContractInput): string[] {
  const { approval, plannedEffects, evidenceEntries, run } = input;
  const reasons: string[] = [];
  const systemCount = unique([
    ...plannedEffects.map((effect) => effect.target.sorName),
    ...policySystems(approval),
    ...approvalPacketSystems(approval),
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
      ...approvalPacketSystems(approval),
    ],
    'No external system declared',
  );
  const proposedAction = describeProposedAction(approval, plannedEffects);
  const intent = describeIntent(approval, workflow, proposedAction);

  return {
    contractName: APPROVAL_CARD_CONTRACT_NAME,
    riskTier,
    reviewDepth,
    fields: {
      proposedAction: {
        label: 'Proposed Action',
        value: proposedAction,
        evidenceSource: plannedEffects.length > 0 ? 'Plan' : 'ApprovalSummary',
      },
      intent: {
        label: 'Goal or intent',
        value: intent.value,
        evidenceSource: intent.evidenceSource,
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
        value: describeEvidence(evidenceEntries, approval),
        evidenceSource: 'Evidence',
      },
      rationale: {
        label: 'Rationale',
        value: describeRationale(approval),
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
