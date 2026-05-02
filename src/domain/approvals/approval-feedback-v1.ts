import {
  ApprovalId,
  EvidenceId,
  PlanId,
  PolicyId,
  RunId,
  WorkItemId,
  type ApprovalId as ApprovalIdType,
  type EvidenceId as EvidenceIdType,
  type PlanId as PlanIdType,
  type PolicyId as PolicyIdType,
  type RunId as RunIdType,
  type WorkItemId as WorkItemIdType,
} from '../primitives/index.js';
import {
  parseRecord,
  readEnum,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export const APPROVAL_FEEDBACK_DECISIONS = [
  'Denied',
  'RequestChanges',
  'LowerScope',
  'Escalate',
] as const;

export type ApprovalFeedbackDecision = (typeof APPROVAL_FEEDBACK_DECISIONS)[number];

export const APPROVAL_FEEDBACK_REASONS = [
  'wrong-goal',
  'wrong-evidence',
  'wrong-risk-level',
  'wrong-execution-plan',
  'missing-context',
  'policy-violation',
  'insufficient-quality',
  'domain-correctness-failure',
] as const;

export type ApprovalFeedbackReason = (typeof APPROVAL_FEEDBACK_REASONS)[number];

export const APPROVAL_FEEDBACK_ROUTE_DESTINATIONS = [
  'current-run',
  'workflow-definition',
  'prompt-strategy',
  'policy-rule',
  'operator-enablement',
] as const;

export type ApprovalFeedbackRouteDestination =
  (typeof APPROVAL_FEEDBACK_ROUTE_DESTINATIONS)[number];

export type ApprovalFeedbackEffect = 'current-run-effect' | 'future-policy-effect' | 'context-only';

export type ApprovalFeedbackCalibrationSurface =
  | 'goal-selection'
  | 'evidence-quality'
  | 'risk-classification'
  | 'execution-plan'
  | 'context-completeness'
  | 'policy-compliance'
  | 'artifact-quality'
  | 'domain-correctness'
  | 'operator-calibration';

export type ApprovalFeedbackRouteV1 = Readonly<{
  destination: ApprovalFeedbackRouteDestination;
  effect: ApprovalFeedbackEffect;
}>;

export type ApprovalFeedbackTargetV1 = Readonly<{
  approvalId: ApprovalIdType;
  runId?: RunIdType;
  planId?: PlanIdType;
  policyId?: PolicyIdType;
  policyVersion?: string;
  workItemId?: WorkItemIdType;
}>;

export type ApprovalFeedbackV1 = Readonly<{
  schemaVersion: 1;
  decision: ApprovalFeedbackDecision;
  reason: ApprovalFeedbackReason;
  rationale: string;
  target: ApprovalFeedbackTargetV1;
  routes: readonly ApprovalFeedbackRouteV1[];
  evidenceRefs: readonly EvidenceIdType[];
  calibrationSurfaces: readonly ApprovalFeedbackCalibrationSurface[];
}>;

export type ApprovalFeedbackInput = Readonly<{
  decision: ApprovalFeedbackDecision;
  reason: ApprovalFeedbackReason;
  rationale: string;
  target: ApprovalFeedbackTargetV1;
  routes: readonly ApprovalFeedbackRouteDestination[];
  evidenceRefs?: readonly EvidenceIdType[];
  calibrationSurfaces?: readonly ApprovalFeedbackCalibrationSurface[];
}>;

export class ApprovalFeedbackParseError extends Error {
  public override readonly name = 'ApprovalFeedbackParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function createApprovalFeedbackV1(input: ApprovalFeedbackInput): ApprovalFeedbackV1 {
  if (!APPROVAL_FEEDBACK_DECISIONS.includes(input.decision)) {
    throw new ApprovalFeedbackParseError('decision must be a supported feedback decision.');
  }
  if (!APPROVAL_FEEDBACK_REASONS.includes(input.reason)) {
    throw new ApprovalFeedbackParseError('reason must be a supported feedback reason.');
  }
  if (input.rationale.trim() === '') {
    throw new ApprovalFeedbackParseError('rationale must be a non-empty string.');
  }
  if (input.routes.length === 0) {
    throw new ApprovalFeedbackParseError('routes must be a non-empty array.');
  }
  for (const surface of input.calibrationSurfaces ?? []) {
    if (!isCalibrationSurface(surface)) {
      throw new ApprovalFeedbackParseError(
        'calibrationSurfaces must contain known calibration surfaces.',
      );
    }
  }

  const routes = input.routes.map((destination) => ({
    destination,
    effect: feedbackRouteEffect(assertRouteDestination(destination)),
  }));

  const feedback: ApprovalFeedbackV1 = {
    schemaVersion: 1,
    decision: input.decision,
    reason: input.reason,
    rationale: input.rationale.trim(),
    target: input.target,
    routes,
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    calibrationSurfaces: [
      ...(input.calibrationSurfaces ?? defaultCalibrationSurfacesForReason(input.reason)),
    ],
  };

  return deepFreeze(feedback);
}

export function parseApprovalFeedbackV1(value: unknown): ApprovalFeedbackV1 {
  const record = readRecord(value, 'ApprovalFeedback', ApprovalFeedbackParseError);
  const schemaVersion = record['schemaVersion'];
  if (schemaVersion !== 1) {
    throw new ApprovalFeedbackParseError(`Unsupported schemaVersion: ${String(schemaVersion)}`);
  }

  const decision = readEnum(
    record,
    'decision',
    APPROVAL_FEEDBACK_DECISIONS,
    ApprovalFeedbackParseError,
  );
  const reason = readEnum(record, 'reason', APPROVAL_FEEDBACK_REASONS, ApprovalFeedbackParseError);
  const rationale = readString(record, 'rationale', ApprovalFeedbackParseError).trim();
  const target = parseTarget(readRecord(record['target'], 'target', ApprovalFeedbackParseError));
  const routes = parseRoutes(record['routes']);
  const evidenceRefs = parseEvidenceRefs(record['evidenceRefs']);
  const calibrationSurfaces = parseCalibrationSurfaces(record['calibrationSurfaces']);

  return createApprovalFeedbackV1({
    decision,
    reason,
    rationale,
    target,
    routes: routes.map((route) => route.destination),
    evidenceRefs,
    ...(calibrationSurfaces !== undefined ? { calibrationSurfaces } : {}),
  });
}

export function feedbackRouteEffect(
  destination: ApprovalFeedbackRouteDestination,
): ApprovalFeedbackEffect {
  if (destination === 'current-run') return 'current-run-effect';
  if (destination === 'operator-enablement') return 'context-only';
  return 'future-policy-effect';
}

export function defaultCalibrationSurfacesForReason(
  reason: ApprovalFeedbackReason,
): readonly ApprovalFeedbackCalibrationSurface[] {
  switch (reason) {
    case 'wrong-goal':
      return ['goal-selection'];
    case 'wrong-evidence':
      return ['evidence-quality'];
    case 'wrong-risk-level':
      return ['risk-classification'];
    case 'wrong-execution-plan':
      return ['execution-plan'];
    case 'missing-context':
      return ['context-completeness'];
    case 'policy-violation':
      return ['policy-compliance'];
    case 'insufficient-quality':
      return ['artifact-quality'];
    case 'domain-correctness-failure':
      return ['domain-correctness', 'operator-calibration'];
  }
}

export function routesCurrentRunOnly(feedback: ApprovalFeedbackV1): boolean {
  return feedback.routes.every((route) => route.destination === 'current-run');
}

export function hasReusableFeedbackRoute(feedback: ApprovalFeedbackV1): boolean {
  return feedback.routes.some((route) => route.effect === 'future-policy-effect');
}

function parseTarget(record: Record<string, unknown>): ApprovalFeedbackTargetV1 {
  const approvalId = ApprovalId(readString(record, 'approvalId', ApprovalFeedbackParseError));
  const runId = readOptionalString(record, 'runId', ApprovalFeedbackParseError);
  const planId = readOptionalString(record, 'planId', ApprovalFeedbackParseError);
  const policyId = readOptionalString(record, 'policyId', ApprovalFeedbackParseError);
  const policyVersion = readOptionalString(record, 'policyVersion', ApprovalFeedbackParseError);
  const workItemId = readOptionalString(record, 'workItemId', ApprovalFeedbackParseError);

  return {
    approvalId,
    ...(runId !== undefined ? { runId: RunId(runId) } : {}),
    ...(planId !== undefined ? { planId: PlanId(planId) } : {}),
    ...(policyId !== undefined ? { policyId: PolicyId(policyId) } : {}),
    ...(policyVersion !== undefined ? { policyVersion } : {}),
    ...(workItemId !== undefined ? { workItemId: WorkItemId(workItemId) } : {}),
  };
}

function parseRoutes(value: unknown): readonly ApprovalFeedbackRouteV1[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApprovalFeedbackParseError('routes must be a non-empty array.');
  }
  return value.map((item, idx) => {
    const record = parseRecord(item, `routes[${idx}]`, ApprovalFeedbackParseError);
    const destination = readEnum(
      record,
      'destination',
      APPROVAL_FEEDBACK_ROUTE_DESTINATIONS,
      ApprovalFeedbackParseError,
    );
    const effect = readEnum(
      record,
      'effect',
      ['current-run-effect', 'future-policy-effect', 'context-only'] as const,
      ApprovalFeedbackParseError,
    );
    const expectedEffect = feedbackRouteEffect(destination);
    if (effect !== expectedEffect) {
      throw new ApprovalFeedbackParseError(
        `routes[${idx}].effect must be ${expectedEffect} for destination ${destination}.`,
      );
    }
    return { destination, effect };
  });
}

function parseEvidenceRefs(value: unknown): readonly EvidenceIdType[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new ApprovalFeedbackParseError('evidenceRefs must be an array when provided.');
  }
  return value.map((item, idx) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new ApprovalFeedbackParseError(`evidenceRefs[${idx}] must be a non-empty string.`);
    }
    return EvidenceId(item);
  });
}

function parseCalibrationSurfaces(
  value: unknown,
): readonly ApprovalFeedbackCalibrationSurface[] | undefined {
  if (value === undefined) return undefined;
  const surfaces = readOptionalStringArray(
    { calibrationSurfaces: value },
    'calibrationSurfaces',
    ApprovalFeedbackParseError,
    { minLength: 1 },
  );
  return (surfaces ?? []).map((surface) => {
    if (!isCalibrationSurface(surface)) {
      throw new ApprovalFeedbackParseError(
        `calibrationSurfaces must contain known calibration surfaces.`,
      );
    }
    return surface;
  });
}

function isCalibrationSurface(value: string): value is ApprovalFeedbackCalibrationSurface {
  return (
    value === 'goal-selection' ||
    value === 'evidence-quality' ||
    value === 'risk-classification' ||
    value === 'execution-plan' ||
    value === 'context-completeness' ||
    value === 'policy-compliance' ||
    value === 'artifact-quality' ||
    value === 'domain-correctness' ||
    value === 'operator-calibration'
  );
}

function assertRouteDestination(
  value: ApprovalFeedbackRouteDestination,
): ApprovalFeedbackRouteDestination {
  if (!APPROVAL_FEEDBACK_ROUTE_DESTINATIONS.includes(value)) {
    throw new ApprovalFeedbackParseError('routes must contain known destinations.');
  }
  return value;
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const child = (obj as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return obj;
}
