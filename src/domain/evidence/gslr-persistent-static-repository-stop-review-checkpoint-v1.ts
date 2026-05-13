import type {
  GslrPersistentStaticRepositoryImplementationReadinessResultV1,
  GslrPersistentStaticRepositoryImplementationReadinessStatusV1,
} from './gslr-persistent-static-repository-implementation-readiness-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_STOP_REVIEW_CHECKPOINT_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-stop-review-checkpoint.v1' as const;

export type GslrPersistentStaticRepositoryStopReviewCheckpointStatusV1 =
  | 'open-implementation-bead'
  | 'pause-for-operator-product-review'
  | 'blocked';

export type GslrPersistentStaticRepositoryStopReviewCheckpointV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_STOP_REVIEW_CHECKPOINT_V1_SCHEMA_VERSION;
  implementationReadiness: Readonly<{
    status: GslrPersistentStaticRepositoryImplementationReadinessStatusV1;
    blockers: readonly string[];
  }>;
  reviewPosture: Readonly<{
    researchStatus: 'complete-enough-for-engineering' | 'open-research-question';
    operatorReview: 'completed' | 'requested' | 'missing';
    productReview: 'completed' | 'requested' | 'missing';
    implementationScope:
      | 'persistent-static-repository-only'
      | 'runtime-ingestion'
      | 'mc-connector-or-actions';
  }>;
  exitCriteria: Readonly<{
    implementationBeadAcceptanceCriteria: 'specified' | 'missing';
    validationPlan: 'specified' | 'missing';
    rollbackPlan: 'specified' | 'missing';
    noRuntimeBoundary: 'documented' | 'missing';
    commitAndPushPlan: 'specified' | 'missing';
  }>;
}>;

export type GslrPersistentStaticRepositoryStopReviewCheckpointResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_STOP_REVIEW_CHECKPOINT_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryStopReviewCheckpointStatusV1;
  blockers: readonly string[];
  reviewNeeds: readonly string[];
  recommendedNextBead: string;
  conclusion: string;
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryStopReviewCheckpointV1(
  implementationReadiness: GslrPersistentStaticRepositoryImplementationReadinessResultV1,
): GslrPersistentStaticRepositoryStopReviewCheckpointV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_STOP_REVIEW_CHECKPOINT_V1_SCHEMA_VERSION,
    implementationReadiness: {
      status: implementationReadiness.status,
      blockers: implementationReadiness.blockers,
    },
    reviewPosture: {
      researchStatus: 'complete-enough-for-engineering',
      operatorReview: 'requested',
      productReview: 'requested',
      implementationScope: 'persistent-static-repository-only',
    },
    exitCriteria: {
      implementationBeadAcceptanceCriteria: 'specified',
      validationPlan: 'specified',
      rollbackPlan: 'specified',
      noRuntimeBoundary: 'documented',
      commitAndPushPlan: 'specified',
    },
  });
}

export function evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1(
  checkpoint: GslrPersistentStaticRepositoryStopReviewCheckpointV1,
): GslrPersistentStaticRepositoryStopReviewCheckpointResultV1 {
  assertSchemaVersion(checkpoint);
  const blockers = [
    ...implementationReadinessBlockers(checkpoint),
    ...reviewPostureBlockers(checkpoint),
    ...exitCriteriaBlockers(checkpoint),
  ];
  const reviewNeeds = reviewNeedsFor(checkpoint);
  const status = statusFor(blockers, reviewNeeds);

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_STOP_REVIEW_CHECKPOINT_V1_SCHEMA_VERSION,
    status,
    blockers,
    reviewNeeds,
    recommendedNextBead:
      status === 'open-implementation-bead'
        ? 'Open the persistent static repository implementation bead.'
        : 'Run operator/product review before opening persistent storage implementation.',
    conclusion: conclusionFor(status),
    boundaryWarnings: [
      'This checkpoint decides readiness to open a future implementation bead only.',
      'It does not add database migrations, production tables, production writes, live prompt-language polling, queues, SSE streams, runtime cards, production actions, or MC connector access.',
      'If review is incomplete, pause engineering and attach the static operator report plus review note before implementation begins.',
    ],
  });
}

function implementationReadinessBlockers(
  checkpoint: GslrPersistentStaticRepositoryStopReviewCheckpointV1,
): string[] {
  if (checkpoint.implementationReadiness.status === 'ready-to-open-implementation-bead') {
    return [];
  }
  return [
    'implementationReadiness status must be ready-to-open-implementation-bead',
    ...checkpoint.implementationReadiness.blockers.map(
      (blocker) => `readiness blocker: ${blocker}`,
    ),
  ];
}

function reviewPostureBlockers(
  checkpoint: GslrPersistentStaticRepositoryStopReviewCheckpointV1,
): string[] {
  const blockers: string[] = [];
  if (checkpoint.reviewPosture.researchStatus !== 'complete-enough-for-engineering') {
    blockers.push('researchStatus must be complete-enough-for-engineering');
  }
  if (checkpoint.reviewPosture.operatorReview === 'missing') {
    blockers.push('operatorReview must be requested or completed');
  }
  if (checkpoint.reviewPosture.productReview === 'missing') {
    blockers.push('productReview must be requested or completed');
  }
  if (checkpoint.reviewPosture.implementationScope !== 'persistent-static-repository-only') {
    blockers.push('implementationScope must remain persistent-static-repository-only');
  }
  return blockers;
}

function exitCriteriaBlockers(
  checkpoint: GslrPersistentStaticRepositoryStopReviewCheckpointV1,
): string[] {
  const blockers: string[] = [];
  if (checkpoint.exitCriteria.implementationBeadAcceptanceCriteria !== 'specified') {
    blockers.push('implementationBeadAcceptanceCriteria must be specified');
  }
  if (checkpoint.exitCriteria.validationPlan !== 'specified') {
    blockers.push('validationPlan must be specified');
  }
  if (checkpoint.exitCriteria.rollbackPlan !== 'specified') {
    blockers.push('rollbackPlan must be specified');
  }
  if (checkpoint.exitCriteria.noRuntimeBoundary !== 'documented') {
    blockers.push('noRuntimeBoundary must be documented');
  }
  if (checkpoint.exitCriteria.commitAndPushPlan !== 'specified') {
    blockers.push('commitAndPushPlan must be specified');
  }
  return blockers;
}

function reviewNeedsFor(
  checkpoint: GslrPersistentStaticRepositoryStopReviewCheckpointV1,
): string[] {
  const needs: string[] = [];
  if (checkpoint.reviewPosture.operatorReview === 'requested') {
    needs.push('operator review must sign off on static-only persistence scope');
  }
  if (checkpoint.reviewPosture.productReview === 'requested') {
    needs.push('product review must confirm persistent storage is useful before runtime ingestion');
  }
  return needs;
}

function statusFor(
  blockers: readonly string[],
  reviewNeeds: readonly string[],
): GslrPersistentStaticRepositoryStopReviewCheckpointStatusV1 {
  if (blockers.length > 0) return 'blocked';
  if (reviewNeeds.length > 0) return 'pause-for-operator-product-review';
  return 'open-implementation-bead';
}

function conclusionFor(status: GslrPersistentStaticRepositoryStopReviewCheckpointStatusV1): string {
  if (status === 'open-implementation-bead') {
    return 'Research and design gates are complete enough to open a tightly scoped persistent static repository implementation bead.';
  }
  if (status === 'pause-for-operator-product-review') {
    return 'Stop broad research, but pause implementation until operator and product review attach an explicit static-only decision.';
  }
  return 'Do not open persistent storage implementation until blockers are cleared.';
}

function assertSchemaVersion(checkpoint: GslrPersistentStaticRepositoryStopReviewCheckpointV1) {
  if (
    checkpoint.schemaVersion !==
    GSLR_PERSISTENT_STATIC_REPOSITORY_STOP_REVIEW_CHECKPOINT_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_STOP_REVIEW_CHECKPOINT_V1_SCHEMA_VERSION}`,
    );
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}
