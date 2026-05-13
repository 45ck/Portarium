export const GSLR_STATIC_IMPORT_READINESS_V1_SCHEMA_VERSION =
  'portarium.gslr-static-import-readiness.v1' as const;

export const GSLR_STATIC_IMPORT_REQUIRED_REVIEW_STATES = [
  'received',
  'verified',
  'quarantined',
  'review_pending',
  'accepted_static',
  'rejected',
  'superseded',
] as const;

export type GslrStaticImportReviewStateV1 =
  (typeof GSLR_STATIC_IMPORT_REQUIRED_REVIEW_STATES)[number];

export type GslrStaticImportReadinessAssessmentV1 = Readonly<{
  schemaVersion: typeof GSLR_STATIC_IMPORT_READINESS_V1_SCHEMA_VERSION;
  proposedImportMode: 'manual-static-preview' | 'persistent-static-review';
  trust: Readonly<{
    signatureTrust: 'test-key' | 'production-keyring';
    keyRevocation: 'absent' | 'documented';
    trustedAlgorithms: readonly ('ed25519' | 'test-ed25519')[];
  }>;
  artifacts: Readonly<{
    byteVerification: 'declared-hashes-only' | 'fetch-and-hash-bytes';
    storageBoundary: 'none' | 'append-only-static-record';
    rawPayloadPolicy: 'reject' | 'allow';
  }>;
  authority: Readonly<{
    runtimeAuthority: 'none' | 'route-decision' | 'action-execution';
    actionControls: 'absent' | 'present';
    liveEndpoints: 'blocked' | 'allowed';
  }>;
  operatorReview: Readonly<{
    stateMachine: 'absent' | 'defined';
    requiredStates: readonly GslrStaticImportReviewStateV1[];
  }>;
  rejectionReporting: Readonly<{
    structuredCodes: 'absent' | 'defined';
  }>;
}>;

export type GslrStaticImportReadinessResultV1 = Readonly<{
  schemaVersion: typeof GSLR_STATIC_IMPORT_READINESS_V1_SCHEMA_VERSION;
  status: 'ready-for-static-import-design-gate' | 'blocked';
  blockers: readonly string[];
  boundaryWarnings: readonly string[];
}>;

export function evaluateGslrStaticImportReadinessV1(
  assessment: GslrStaticImportReadinessAssessmentV1,
): GslrStaticImportReadinessResultV1 {
  const blockers: string[] = [];

  if (assessment.proposedImportMode !== 'persistent-static-review') {
    blockers.push('proposedImportMode must be persistent-static-review before import work starts');
  }

  if (assessment.trust.signatureTrust !== 'production-keyring') {
    blockers.push('production keyring trust must replace test-key signatures');
  }
  if (assessment.trust.keyRevocation !== 'documented') {
    blockers.push('key revocation and rotation handling must be documented');
  }
  if (
    assessment.trust.trustedAlgorithms.includes('test-ed25519') ||
    !assessment.trust.trustedAlgorithms.includes('ed25519')
  ) {
    blockers.push('trustedAlgorithms must allow ed25519 and exclude test-ed25519');
  }

  if (assessment.artifacts.byteVerification !== 'fetch-and-hash-bytes') {
    blockers.push('artifact byte verification must fetch and hash artifact content');
  }
  if (assessment.artifacts.storageBoundary !== 'append-only-static-record') {
    blockers.push('storageBoundary must be append-only-static-record');
  }
  if (assessment.artifacts.rawPayloadPolicy !== 'reject') {
    blockers.push('raw payload policy must reject raw/source payload bodies');
  }

  if (assessment.authority.runtimeAuthority !== 'none') {
    blockers.push('runtimeAuthority must remain none');
  }
  if (assessment.authority.actionControls !== 'absent') {
    blockers.push('imported static evidence must not expose action controls');
  }
  if (assessment.authority.liveEndpoints !== 'blocked') {
    blockers.push('import readiness must keep live engineering endpoints blocked');
  }

  if (assessment.operatorReview.stateMachine !== 'defined') {
    blockers.push('operator review state machine must be defined');
  }
  for (const state of GSLR_STATIC_IMPORT_REQUIRED_REVIEW_STATES) {
    if (!assessment.operatorReview.requiredStates.includes(state)) {
      blockers.push(`operator review state is missing ${state}`);
    }
  }

  if (assessment.rejectionReporting.structuredCodes !== 'defined') {
    blockers.push('structured verifier rejection codes must be defined');
  }

  return Object.freeze({
    schemaVersion: GSLR_STATIC_IMPORT_READINESS_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-for-static-import-design-gate' : 'blocked',
    blockers: Object.freeze([...blockers]),
    boundaryWarnings: Object.freeze([
      'Passing this gate authorizes static import design only.',
      'Passing this gate does not authorize runtime Cockpit cards, route decisions, queues, SSE, production actions, or MC connector access.',
      'Any implementation must continue to reject imported evidence that claims runtime authority or action controls.',
    ]),
  });
}
