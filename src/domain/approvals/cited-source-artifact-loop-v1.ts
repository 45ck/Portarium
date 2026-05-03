import {
  EvidenceId,
  PlanId,
  PolicyId,
  RunId,
  WorkspaceId,
  type EvidenceId as EvidenceIdType,
  type PlanId as PlanIdType,
  type PolicyId as PolicyIdType,
  type RunId as RunIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import type { DecisionContextPacketV1 } from './decision-context-packet-v1.js';

export type SourceTrustClassV1 = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
export type ResearchDossierArtifactKindV1 =
  | 'research-dossier'
  | 'opportunity-brief'
  | 'content-brief'
  | 'showcase-brief';
export type ResearchClaimTypeV1 =
  | 'fact'
  | 'interpretation'
  | 'recommendation'
  | 'hypothesis'
  | 'user-intent';
export type ResearchClaimConfidenceV1 = 'high' | 'medium' | 'low' | 'unknown';
export type ResearchClaimFreshnessStateV1 = 'fresh' | 'stale' | 'needs-reread';
export type ResearchClaimConflictStateV1 = 'none' | 'unresolved' | 'resolved';
export type ResearchClaimUseV1 =
  | 'ideation'
  | 'drafting'
  | 'planning'
  | 'approval-context'
  | 'execution-input'
  | 'external-publication'
  | 'autonomous-execution';
export type DownstreamArtifactClassV1 = 'content' | 'micro-saas' | 'showcase' | 'prototype';
export type DownstreamArtifactReadinessV1 =
  | 'internal-draft-only'
  | 'planning-ready-with-approval'
  | 'approval-context-ready'
  | 'blocked-pending-more-evidence';
export type SourceArtifactSufficiencyStatusV1 = 'sufficient' | 'insufficient' | 'blocked';

export type SourceSnapshotRefV1 = Readonly<{
  sourceSnapshotId: string;
  evidenceId: EvidenceIdType;
  sourceClass: SourceTrustClassV1;
  retrievedAtIso: string;
  freshnessRequiredBeforeIso: string;
  title: string;
  locator: string;
}>;

export type ResearchDossierClaimV1 = Readonly<{
  claimId: string;
  text: string;
  claimType: ResearchClaimTypeV1;
  citations: readonly string[];
  confidence: ResearchClaimConfidenceV1;
  confidenceRationale: string;
  claimBoundary: string;
  stalenessState: ResearchClaimFreshnessStateV1;
  conflictState: ResearchClaimConflictStateV1;
  allowedUses: readonly ResearchClaimUseV1[];
  forbiddenUses: readonly ResearchClaimUseV1[];
}>;

export type ResearchDossierV1 = Readonly<{
  schemaVersion: 1;
  dossierId: string;
  workspaceId: WorkspaceIdType;
  runId: RunIdType;
  artifactKind: ResearchDossierArtifactKindV1;
  goal: string;
  scopeBoundary: Readonly<{ inScope: readonly string[]; outOfScope: readonly string[] }>;
  sourceSnapshots: readonly string[];
  claims: readonly ResearchDossierClaimV1[];
  openQuestions: readonly string[];
  conflicts: readonly string[];
  recommendedNextActions: readonly string[];
}>;

export type CitedDownstreamArtifactV1 = Readonly<{
  artifactId: string;
  artifactClass: DownstreamArtifactClassV1;
  title: string;
  readiness: DownstreamArtifactReadinessV1;
  dossierId: string;
  claimIdsUsed: readonly string[];
  sourceSnapshotIds: readonly string[];
  transformations: readonly string[];
  boundaryChanged: boolean;
  evidenceId: EvidenceIdType;
}>;

export type CitedSourceArtifactLoopV1 = Readonly<{
  schemaVersion: 1;
  workspaceId: WorkspaceIdType;
  runId: RunIdType;
  sourceSnapshots: readonly SourceSnapshotRefV1[];
  dossier: ResearchDossierV1;
  downstreamArtifacts: readonly CitedDownstreamArtifactV1[];
  assembledAtIso: string;
}>;

export type SourceArtifactSufficiencyV1 = Readonly<{
  schemaVersion: 1;
  status: SourceArtifactSufficiencyStatusV1;
  canUseForApprovalContext: boolean;
  canUseForExecutionInput: boolean;
  canUseForExternalPublication: boolean;
  missingEvidenceSignals: readonly string[];
  blockingReasons: readonly string[];
  citedClaimIds: readonly string[];
  artifactIds: readonly string[];
}>;

export class CitedSourceArtifactLoopValidationError extends Error {
  public override readonly name = 'CitedSourceArtifactLoopValidationError';
}

export function validateCitedSourceArtifactLoopV1(loop: CitedSourceArtifactLoopV1): void {
  assertNonEmpty(loop.sourceSnapshots, 'sourceSnapshots');
  assertNonEmpty(loop.dossier.claims, 'dossier.claims');
  assertNonEmpty(loop.downstreamArtifacts, 'downstreamArtifacts');

  if (loop.dossier.workspaceId !== loop.workspaceId || loop.dossier.runId !== loop.runId) {
    throw new CitedSourceArtifactLoopValidationError(
      'dossier Workspace and Run must match the loop.',
    );
  }

  const sourceIds = new Set(loop.sourceSnapshots.map((source) => source.sourceSnapshotId));
  for (const sourceSnapshotId of loop.dossier.sourceSnapshots) {
    if (!sourceIds.has(sourceSnapshotId)) {
      throw new CitedSourceArtifactLoopValidationError(
        `dossier references unknown Source Snapshot ${sourceSnapshotId}.`,
      );
    }
  }

  const claimIds = new Set(loop.dossier.claims.map((claim) => claim.claimId));
  for (const artifact of loop.downstreamArtifacts) {
    if (artifact.dossierId !== loop.dossier.dossierId) {
      throw new CitedSourceArtifactLoopValidationError(
        `artifact ${artifact.artifactId} references a different dossier.`,
      );
    }
    assertNonEmpty(artifact.claimIdsUsed, `artifact ${artifact.artifactId} claimIdsUsed`);
    assertNonEmpty(artifact.sourceSnapshotIds, `artifact ${artifact.artifactId} sourceSnapshotIds`);
    for (const claimId of artifact.claimIdsUsed) {
      if (!claimIds.has(claimId)) {
        throw new CitedSourceArtifactLoopValidationError(
          `artifact ${artifact.artifactId} references unknown claim ${claimId}.`,
        );
      }
    }
    for (const sourceSnapshotId of artifact.sourceSnapshotIds) {
      if (!sourceIds.has(sourceSnapshotId)) {
        throw new CitedSourceArtifactLoopValidationError(
          `artifact ${artifact.artifactId} references unknown Source Snapshot ${sourceSnapshotId}.`,
        );
      }
    }
  }
}

export function assessCitedSourceArtifactLoopV1(
  loop: CitedSourceArtifactLoopV1,
): SourceArtifactSufficiencyV1 {
  validateCitedSourceArtifactLoopV1(loop);

  const missingEvidenceSignals: string[] = [];
  const blockingReasons: string[] = [];
  const sourceIds = new Set(loop.sourceSnapshots.map((source) => source.sourceSnapshotId));
  const citedClaimIds: string[] = [];
  let hasExecutionInputClaim = false;

  for (const claim of loop.dossier.claims) {
    const missingCitation = claim.citations.length === 0;
    const unknownCitation = claim.citations.some(
      (sourceSnapshotId) => !sourceIds.has(sourceSnapshotId),
    );
    if (missingCitation || unknownCitation) {
      missingEvidenceSignals.push(`${claim.claimId}: missing or unknown citation.`);
    } else {
      citedClaimIds.push(claim.claimId);
    }
    if (claim.confidence === 'unknown' && claim.allowedUses.includes('approval-context')) {
      blockingReasons.push(`${claim.claimId}: unknown confidence cannot support approval context.`);
    }
    if (claim.allowedUses.includes('execution-input')) {
      hasExecutionInputClaim = true;
    }
    if (
      claim.allowedUses.includes('execution-input') &&
      claim.forbiddenUses.includes('autonomous-execution')
    ) {
      blockingReasons.push(
        `${claim.claimId}: execution input conflicts with forbidden autonomous use.`,
      );
    }
    if (claim.stalenessState !== 'fresh') {
      missingEvidenceSignals.push(`${claim.claimId}: source freshness is ${claim.stalenessState}.`);
    }
    if (claim.conflictState === 'unresolved') {
      blockingReasons.push(`${claim.claimId}: unresolved source conflict.`);
    }
    if (claim.claimBoundary.trim() === '') {
      blockingReasons.push(`${claim.claimId}: claim boundary is missing.`);
    }
  }

  for (const artifact of loop.downstreamArtifacts) {
    const claims = loop.dossier.claims.filter((claim) =>
      artifact.claimIdsUsed.includes(claim.claimId),
    );
    const executionClaim = claims.some((claim) => claim.allowedUses.includes('execution-input'));
    if (artifact.boundaryChanged) {
      missingEvidenceSignals.push(`${artifact.artifactId}: claim boundary changed downstream.`);
    }
    if (artifact.readiness === 'internal-draft-only' && executionClaim) {
      blockingReasons.push(
        `${artifact.artifactId}: draft-only artifact cannot support execution input.`,
      );
    }
  }

  const status: SourceArtifactSufficiencyStatusV1 =
    blockingReasons.length > 0
      ? 'blocked'
      : missingEvidenceSignals.length > 0
        ? 'insufficient'
        : 'sufficient';

  return Object.freeze({
    schemaVersion: 1,
    status,
    canUseForApprovalContext: status === 'sufficient',
    canUseForExecutionInput:
      status === 'sufficient' &&
      hasExecutionInputClaim &&
      loop.downstreamArtifacts.some((artifact) => artifact.readiness === 'approval-context-ready'),
    canUseForExternalPublication: false,
    missingEvidenceSignals: Object.freeze(missingEvidenceSignals),
    blockingReasons: Object.freeze(blockingReasons),
    citedClaimIds: Object.freeze([...new Set(citedClaimIds)].sort()),
    artifactIds: Object.freeze(
      loop.downstreamArtifacts.map((artifact) => artifact.artifactId).sort(),
    ),
  });
}

export function buildDecisionContextPacketFromCitedArtifactV1(params: {
  packetId: string;
  loop: CitedSourceArtifactLoopV1;
  planId: PlanIdType;
  proposedChangeSummary: string;
  policyId: PolicyIdType | string;
  assembledAtIso: string;
}): DecisionContextPacketV1 {
  const sufficiency = assessCitedSourceArtifactLoopV1(params.loop);
  const packet: DecisionContextPacketV1 = {
    schemaVersion: 1,
    packetId: params.packetId,
    workspaceId: params.loop.workspaceId,
    surface: 'approval',
    target: {
      runId: params.loop.runId,
      planId: params.planId,
    },
    declaredGoal: params.loop.dossier.goal,
    scopeBoundary: [
      ...params.loop.dossier.scopeBoundary.inScope,
      ...params.loop.dossier.scopeBoundary.outOfScope.map((item) => `out: ${item}`),
    ].join('; '),
    currentStep: 'source-to-artifact-citation-loop',
    nextStepPreview:
      sufficiency.status === 'sufficient'
        ? 'review generated artifact packet'
        : 'request more evidence',
    proposedChange: {
      kind: 'action',
      summary: params.proposedChangeSummary,
      blastRadius: params.loop.downstreamArtifacts.map((artifact) => artifact.artifactClass),
      reversibility: 'partial',
    },
    policy: {
      policyIds: [
        typeof params.policyId === 'string' ? PolicyId(params.policyId) : params.policyId,
      ],
      rationale:
        'Cited artifact packet preserves Source Snapshot, claim, and downstream artifact provenance.',
      executionTier: sufficiency.status === 'sufficient' ? 'HumanApprove' : 'ManualOnly',
      budgetImpact: 'No dispatch until citation sufficiency is satisfied.',
      complianceImplications: sufficiency.blockingReasons,
    },
    evidence: {
      requirements: [
        {
          requirementId: 'cited-source-claims',
          label: 'Material claims cite Source Snapshots',
          required: true,
          satisfiedByEvidenceIds: params.loop.sourceSnapshots.map((source) => source.evidenceId),
        },
      ],
      artifacts: params.loop.downstreamArtifacts.map((artifact) => ({
        evidenceId: artifact.evidenceId,
        summary: artifact.title,
        category: 'Plan',
      })),
      consultedEvidenceIds: params.loop.sourceSnapshots.map((source) => source.evidenceId),
      missingEvidenceSignals: sufficiency.missingEvidenceSignals,
    },
    uncertainty: {
      confidenceScore: sufficiency.status === 'sufficient' ? 0.85 : 0.45,
      anomalyFlags: sufficiency.blockingReasons,
      unknowns: params.loop.dossier.openQuestions,
    },
    provenance: {
      agentOutputRefs: params.loop.downstreamArtifacts.map((artifact) => artifact.evidenceId),
      materialInputSummaries: params.loop.dossier.claims.map((claim) => claim.claimId),
    },
    allowedDecisions:
      sufficiency.status === 'sufficient'
        ? ['approve', 'deny', 'request-changes', 'request-more-evidence']
        : ['request-more-evidence', 'escalate', 'annotate'],
    assembledAtIso: params.assembledAtIso,
  };

  return Object.freeze(packet);
}

export function makeEvidenceId(value: string): EvidenceIdType {
  return EvidenceId(value);
}

export function makePlanId(value: string): PlanIdType {
  return PlanId(value);
}

export function makeRunId(value: string): RunIdType {
  return RunId(value);
}

export function makeWorkspaceId(value: string): WorkspaceIdType {
  return WorkspaceId(value);
}

function assertNonEmpty(value: readonly unknown[], field: string): void {
  if (value.length === 0) {
    throw new CitedSourceArtifactLoopValidationError(`${field} must be non-empty.`);
  }
}
