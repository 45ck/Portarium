import {
  ENGINEERING_EVIDENCE_CARD_INPUT_V1_SCHEMA_VERSION,
  parseEngineeringEvidenceCardInputV1,
  type EngineeringEvidenceCardActionStatus,
  type EngineeringEvidenceCardInputV1,
} from './engineering-evidence-card-v1.js';

export const GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION =
  'portarium.gslr-engineering-evidence-card-projection-input.v1' as const;

type Scalar = string | number | boolean | null;

export type GslrRoutePolicyDecisionV1 =
  | 'local-screen'
  | 'advisor-only'
  | 'frontier-baseline'
  | 'hybrid-required';

export type GslrRouteArmV1 = 'local-only' | 'frontier-only' | 'advisor-only' | 'hybrid-router';

export type GslrMeasuredArmEvidenceV1 = Readonly<{
  arm: GslrRouteArmV1;
  runId: string;
  runGroupId: string | null;
  finalVerdict: 'pass' | 'fail' | 'blocked' | string | null;
  privateOracle: 'pass' | 'fail';
  blockingReviewDefects: readonly string[];
  frontierTokens: number;
  cachedInputTokens?: number;
  providerUsd: number;
  localWallSeconds: number;
  selectedModel: string | null;
  selectedProvider: string | null;
  reason: string;
}>;

export type GslrEngineeringEvidenceCardProjectionInputV1 = Readonly<{
  schemaVersion: typeof GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION;
  source: Readonly<{
    manifestSchemaVersion: Scalar;
  }>;
  policyVersion: string | null;
  route: Readonly<{
    task: string;
    policyDecision: GslrRoutePolicyDecisionV1;
    selectedRun: GslrMeasuredArmEvidenceV1;
  }>;
  artifactRefs: Readonly<{
    manifest: string;
    oracleStdout: string | null;
    oracleStderr: string | null;
  }>;
}>;

export class GslrEngineeringEvidenceCardProjectionError extends Error {
  public override readonly name = 'GslrEngineeringEvidenceCardProjectionError';

  public constructor(message: string) {
    super(message);
  }
}

export function projectGslrRouteEvidenceToEngineeringCardInputV1(
  input: GslrEngineeringEvidenceCardProjectionInputV1,
): EngineeringEvidenceCardInputV1 {
  validateProjectionInput(input);

  const actionStatus = deriveActionStatus(input.route.selectedRun);
  const card = {
    schemaVersion: ENGINEERING_EVIDENCE_CARD_INPUT_V1_SCHEMA_VERSION,
    source: {
      system: 'prompt-language',
      area: 'harness-arena',
      manifestSchemaVersion: input.source.manifestSchemaVersion,
    },
    workItem: {
      id: input.route.task,
      runId: input.route.selectedRun.runId,
      runGroupId: input.route.selectedRun.runGroupId,
      policyVersion: input.policyVersion,
    },
    route: {
      arm: input.route.selectedRun.arm,
      decision: input.route.selectedRun.arm,
      policyDecision: input.route.policyDecision,
      selectedModel: input.route.selectedRun.selectedModel,
      selectedProvider: input.route.selectedRun.selectedProvider,
      reason: input.route.selectedRun.reason,
    },
    gates: {
      finalVerdict: input.route.selectedRun.finalVerdict,
      privateOracle: input.route.selectedRun.privateOracle,
      blockingReviewDefects: [...input.route.selectedRun.blockingReviewDefects],
    },
    cost: {
      frontierTokensTotal: input.route.selectedRun.frontierTokens,
      cachedInputTokensTotal: input.route.selectedRun.cachedInputTokens ?? 0,
      providerUsdTotal: input.route.selectedRun.providerUsd,
      localWallSecondsTotal: input.route.selectedRun.localWallSeconds,
    },
    actionBoundary: {
      status: actionStatus,
      reason: deriveActionBoundaryReason(input.route.selectedRun, actionStatus),
    },
    artifactRefs: {
      manifest: input.artifactRefs.manifest,
      oracleStdout: input.artifactRefs.oracleStdout,
      oracleStderr: input.artifactRefs.oracleStderr,
    },
  } satisfies EngineeringEvidenceCardInputV1;

  return parseEngineeringEvidenceCardInputV1(card);
}

function deriveActionStatus(run: GslrMeasuredArmEvidenceV1): EngineeringEvidenceCardActionStatus {
  if (
    run.finalVerdict === 'pass' &&
    run.privateOracle === 'pass' &&
    run.blockingReviewDefects.length === 0
  ) {
    return 'research-only';
  }
  return 'blocked';
}

function deriveActionBoundaryReason(
  run: GslrMeasuredArmEvidenceV1,
  status: EngineeringEvidenceCardActionStatus,
): string {
  if (status === 'research-only') {
    return 'static projection only: final verdict, private oracle, and review gates passed';
  }

  const reasons = [];
  if (run.finalVerdict !== 'pass') reasons.push(`final verdict is ${String(run.finalVerdict)}`);
  if (run.privateOracle !== 'pass') reasons.push(`private oracle is ${run.privateOracle}`);
  if (run.blockingReviewDefects.length > 0) reasons.push('blocking review defects are present');
  return `blocked static projection: ${reasons.join('; ')}`;
}

function validateProjectionInput(input: GslrEngineeringEvidenceCardProjectionInputV1) {
  if (input.schemaVersion !== GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION) {
    throw new GslrEngineeringEvidenceCardProjectionError(
      `schemaVersion must be ${GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION}`,
    );
  }
  if (!input.route.task.trim()) {
    throw new GslrEngineeringEvidenceCardProjectionError('route.task is required');
  }
  assertArtifactRef(input.artifactRefs.manifest, 'artifactRefs.manifest');
  if (input.artifactRefs.oracleStdout !== null) {
    assertArtifactRef(input.artifactRefs.oracleStdout, 'artifactRefs.oracleStdout');
  }
  if (input.artifactRefs.oracleStderr !== null) {
    assertArtifactRef(input.artifactRefs.oracleStderr, 'artifactRefs.oracleStderr');
  }
}

function assertArtifactRef(value: string, field: string) {
  if (!value.trim()) {
    throw new GslrEngineeringEvidenceCardProjectionError(`${field} is required`);
  }
  if (value.includes('?') || value.includes('#')) {
    throw new GslrEngineeringEvidenceCardProjectionError(
      `${field} must not include query or fragment data`,
    );
  }
  if (value.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    throw new GslrEngineeringEvidenceCardProjectionError(
      `${field} must be a repository-relative artifact reference`,
    );
  }
  if (value.split(/[\\/]+/).includes('..')) {
    throw new GslrEngineeringEvidenceCardProjectionError(`${field} must not traverse parents`);
  }
}
