import type {
  ApprovalId as ApprovalIdType,
  EvidenceId as EvidenceIdType,
  PlanId as PlanIdType,
  PolicyId as PolicyIdType,
  RunId as RunIdType,
  WorkItemId as WorkItemIdType,
  WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export type DecisionContextSurface = 'approval' | 'steering' | 'policy-change' | 'override';
export type DecisionContextChangeKind = 'action' | 'policy-change' | 'steering' | 'override';
export type DecisionContextReversibility = 'full' | 'partial' | 'none';
export type DecisionContextSufficiencyStatus = 'sufficient' | 'insufficient' | 'blocked';
export type DecisionContextNextAction =
  | 'approve'
  | 'deny'
  | 'request-changes'
  | 'request-more-evidence'
  | 'steer'
  | 'escalate'
  | 'override'
  | 'annotate';

export type DecisionContextTargetV1 = Readonly<{
  runId?: RunIdType;
  approvalId?: ApprovalIdType;
  planId?: PlanIdType;
  policyId?: PolicyIdType;
  policyVersion?: string;
  workItemId?: WorkItemIdType;
}>;

export type DecisionContextProposedChangeV1 = Readonly<{
  kind: DecisionContextChangeKind;
  summary: string;
  blastRadius: readonly string[];
  reversibility: DecisionContextReversibility;
}>;

export type DecisionContextPolicyV1 = Readonly<{
  policyIds: readonly PolicyIdType[];
  rationale: string;
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
  budgetImpact: string;
  complianceImplications: readonly string[];
}>;

export type DecisionEvidenceRequirementV1 = Readonly<{
  requirementId: string;
  label: string;
  required: boolean;
  satisfiedByEvidenceIds: readonly EvidenceIdType[];
}>;

export type DecisionEvidenceArtifactRefV1 = Readonly<{
  evidenceId: EvidenceIdType;
  summary: string;
  category: 'Plan' | 'Action' | 'Approval' | 'Policy' | 'PolicyViolation' | 'System';
}>;

export type DecisionContextEvidenceV1 = Readonly<{
  requirements: readonly DecisionEvidenceRequirementV1[];
  artifacts: readonly DecisionEvidenceArtifactRefV1[];
  consultedEvidenceIds: readonly EvidenceIdType[];
  missingEvidenceSignals: readonly string[];
}>;

export type DecisionContextUncertaintyV1 = Readonly<{
  confidenceScore?: number;
  anomalyFlags: readonly string[];
  unknowns: readonly string[];
}>;

export type DecisionContextProvenanceV1 = Readonly<{
  agentOutputRefs: readonly EvidenceIdType[];
  materialInputSummaries: readonly string[];
}>;

export type DecisionContextPacketV1 = Readonly<{
  schemaVersion: 1;
  packetId: string;
  workspaceId: WorkspaceIdType;
  surface: DecisionContextSurface;
  target: DecisionContextTargetV1;
  declaredGoal: string;
  scopeBoundary: string;
  currentStep: string;
  nextStepPreview: string;
  proposedChange: DecisionContextProposedChangeV1;
  policy: DecisionContextPolicyV1;
  evidence: DecisionContextEvidenceV1;
  uncertainty: DecisionContextUncertaintyV1;
  provenance: DecisionContextProvenanceV1;
  allowedDecisions: readonly DecisionContextNextAction[];
  assembledAtIso: string;
}>;

export type DecisionContextSufficiencyV1 = Readonly<{
  status: DecisionContextSufficiencyStatus;
  canSubmitDecision: boolean;
  canRequestMoreEvidence: boolean;
  missingEvidence: readonly string[];
  blockingReasons: readonly string[];
  recommendedNextActions: readonly DecisionContextNextAction[];
}>;

export class DecisionContextPacketValidationError extends Error {
  public override readonly name = 'DecisionContextPacketValidationError';
}

export function assessDecisionContextSufficiency(
  packet: DecisionContextPacketV1,
): DecisionContextSufficiencyV1 {
  validateDecisionContextPacket(packet);

  const missingEvidence = [
    ...packet.evidence.requirements
      .filter((item) => item.required && item.satisfiedByEvidenceIds.length === 0)
      .map((item) => item.label),
    ...packet.evidence.missingEvidenceSignals,
  ];

  const blockingReasons: string[] = [];
  if (packet.policy.rationale.trim() === '') {
    blockingReasons.push('Policy rationale is missing.');
  }
  if (packet.proposedChange.blastRadius.length === 0) {
    blockingReasons.push('Blast radius is missing.');
  }
  if (packet.provenance.materialInputSummaries.length === 0) {
    blockingReasons.push('Material input provenance is missing.');
  }

  const hasMissingEvidence = missingEvidence.length > 0;
  const status: DecisionContextSufficiencyStatus =
    blockingReasons.length > 0 ? 'blocked' : hasMissingEvidence ? 'insufficient' : 'sufficient';
  const canRequestMoreEvidence =
    packet.allowedDecisions.includes('request-more-evidence') &&
    (hasMissingEvidence || status === 'blocked');
  const canSubmitDecision = status === 'sufficient';
  const recommendedNextActions: readonly DecisionContextNextAction[] = canSubmitDecision
    ? packet.allowedDecisions
    : canRequestMoreEvidence
      ? ['request-more-evidence', 'escalate', 'annotate']
      : ['escalate', 'annotate'];

  return Object.freeze({
    status,
    canSubmitDecision,
    canRequestMoreEvidence,
    missingEvidence: Object.freeze(missingEvidence),
    blockingReasons: Object.freeze(blockingReasons),
    recommendedNextActions: Object.freeze([...recommendedNextActions]),
  });
}

export function validateDecisionContextPacket(packet: DecisionContextPacketV1): void {
  assertNonEmpty(packet.packetId, 'packetId');
  assertNonEmpty(packet.declaredGoal, 'declaredGoal');
  assertNonEmpty(packet.scopeBoundary, 'scopeBoundary');
  assertNonEmpty(packet.currentStep, 'currentStep');
  assertNonEmpty(packet.nextStepPreview, 'nextStepPreview');
  assertNonEmpty(packet.proposedChange.summary, 'proposedChange.summary');
  assertNonEmpty(packet.assembledAtIso, 'assembledAtIso');

  if (!hasTarget(packet.target)) {
    throw new DecisionContextPacketValidationError('target must identify at least one object.');
  }
  if (packet.policy.policyIds.length === 0) {
    throw new DecisionContextPacketValidationError('policy.policyIds must not be empty.');
  }
  if (packet.allowedDecisions.length === 0) {
    throw new DecisionContextPacketValidationError('allowedDecisions must not be empty.');
  }
  if (
    packet.uncertainty.confidenceScore !== undefined &&
    (packet.uncertainty.confidenceScore < 0 || packet.uncertainty.confidenceScore > 1)
  ) {
    throw new DecisionContextPacketValidationError(
      'uncertainty.confidenceScore must be between 0 and 1.',
    );
  }
}

function hasTarget(target: DecisionContextTargetV1): boolean {
  return Boolean(
    target.runId ?? target.approvalId ?? target.planId ?? target.policyId ?? target.workItemId,
  );
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim() === '') {
    throw new DecisionContextPacketValidationError(`${field} must be non-empty.`);
  }
}
