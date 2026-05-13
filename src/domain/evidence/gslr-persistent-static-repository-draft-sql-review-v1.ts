import type {
  GslrPersistentStaticRepositoryDraftPostgresAdapterResultV1,
  GslrPersistentStaticRepositoryDraftPostgresAdapterStatusV1,
} from './gslr-persistent-static-repository-draft-postgres-adapter-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_SQL_REVIEW_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-draft-sql-review.v1' as const;

export type GslrPersistentStaticRepositoryDraftSqlReviewStatusV1 =
  | 'ready-for-executable-adapter-design-review'
  | 'blocked';

export type GslrPersistentStaticRepositoryDraftSqlReviewV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_SQL_REVIEW_V1_SCHEMA_VERSION;
  scaffold: Readonly<{
    status: GslrPersistentStaticRepositoryDraftPostgresAdapterStatusV1;
    blockers: readonly string[];
  }>;
  reviewScope: Readonly<{
    tableMappingReviewed: boolean;
    statementPlanReviewed: boolean;
    constraintSetReviewed: boolean;
    rollbackPostureReviewed: boolean;
    contractAssertionCoverageReviewed: boolean;
    executableAdapterCodeIncluded: boolean;
  }>;
  sqlSafety: Readonly<{
    statementMode: 'draft-not-executable' | 'executable';
    parameterizedStatements: boolean;
    rawPayloadColumn: 'absent' | 'present';
    productionDdl: 'absent' | 'present';
    productionDml: 'absent' | 'present';
    connectionConfig: 'absent' | 'present';
  }>;
  reviewerDecision: Readonly<{
    engineeringDecision: 'approve-next-design-review' | 'request-changes';
    securityDecision: 'approve-next-design-review' | 'request-changes';
    dataDecision: 'approve-next-design-review' | 'request-changes';
  }>;
  authority: Readonly<{
    livePromptLanguagePolling: 'blocked' | 'allowed';
    queues: 'absent' | 'present';
    sseStreams: 'absent' | 'present';
    runtimeCards: 'absent' | 'present';
    productionActions: 'blocked' | 'allowed';
    mcConnectorAccess: 'blocked' | 'allowed';
  }>;
}>;

export type GslrPersistentStaticRepositoryDraftSqlReviewResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_SQL_REVIEW_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryDraftSqlReviewStatusV1;
  blockers: readonly string[];
  reviewedArtifacts: readonly string[];
  recommendedNextBead: string;
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryDraftSqlReviewV1(
  scaffold: GslrPersistentStaticRepositoryDraftPostgresAdapterResultV1,
): GslrPersistentStaticRepositoryDraftSqlReviewV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_SQL_REVIEW_V1_SCHEMA_VERSION,
    scaffold: {
      status: scaffold.status,
      blockers: scaffold.blockers,
    },
    reviewScope: {
      tableMappingReviewed: true,
      statementPlanReviewed: true,
      constraintSetReviewed: true,
      rollbackPostureReviewed: true,
      contractAssertionCoverageReviewed: true,
      executableAdapterCodeIncluded: false,
    },
    sqlSafety: {
      statementMode: 'draft-not-executable',
      parameterizedStatements: true,
      rawPayloadColumn: 'absent',
      productionDdl: 'absent',
      productionDml: 'absent',
      connectionConfig: 'absent',
    },
    reviewerDecision: {
      engineeringDecision: 'approve-next-design-review',
      securityDecision: 'approve-next-design-review',
      dataDecision: 'approve-next-design-review',
    },
    authority: {
      livePromptLanguagePolling: 'blocked',
      queues: 'absent',
      sseStreams: 'absent',
      runtimeCards: 'absent',
      productionActions: 'blocked',
      mcConnectorAccess: 'blocked',
    },
  });
}

export function evaluateGslrPersistentStaticRepositoryDraftSqlReviewV1(
  review: GslrPersistentStaticRepositoryDraftSqlReviewV1,
): GslrPersistentStaticRepositoryDraftSqlReviewResultV1 {
  assertSchemaVersion(review);
  const blockers = [
    ...scaffoldBlockers(review),
    ...reviewScopeBlockers(review),
    ...sqlSafetyBlockers(review),
    ...reviewerDecisionBlockers(review),
    ...authorityBlockers(review),
  ];

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_SQL_REVIEW_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-for-executable-adapter-design-review' : 'blocked',
    blockers,
    reviewedArtifacts: [
      'draft PostgreSQL table mapping',
      'draft PostgreSQL statement plan',
      'idempotency, record ID, fingerprint, raw payload, and review-state constraints',
      'draft-drop-only rollback posture',
      'GSLR-27 adapter contract assertion coverage plan',
      'no-runtime authority guard list',
    ],
    recommendedNextBead:
      blockers.length === 0
        ? 'Open an executable adapter design-review bead, still without database connection config, applied migrations, production tables, or production writes.'
        : 'Resolve draft SQL review blockers before any executable adapter design work.',
    boundaryWarnings: [
      'This review packet reviews the draft SQL scaffold only.',
      'It does not create executable adapter code, database connections, migrations, production tables, or production writes.',
      'It does not poll prompt-language manifests, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
    ],
  });
}

function scaffoldBlockers(review: GslrPersistentStaticRepositoryDraftSqlReviewV1): string[] {
  if (review.scaffold.status === 'ready-for-draft-adapter-code-review') return [];
  return [
    'scaffold status must be ready-for-draft-adapter-code-review',
    ...review.scaffold.blockers.map((blocker) => `scaffold blocker: ${blocker}`),
  ];
}

function reviewScopeBlockers(review: GslrPersistentStaticRepositoryDraftSqlReviewV1): string[] {
  const blockers: string[] = [];
  if (!review.reviewScope.tableMappingReviewed) {
    blockers.push('tableMappingReviewed must be true');
  }
  if (!review.reviewScope.statementPlanReviewed) {
    blockers.push('statementPlanReviewed must be true');
  }
  if (!review.reviewScope.constraintSetReviewed) {
    blockers.push('constraintSetReviewed must be true');
  }
  if (!review.reviewScope.rollbackPostureReviewed) {
    blockers.push('rollbackPostureReviewed must be true');
  }
  if (!review.reviewScope.contractAssertionCoverageReviewed) {
    blockers.push('contractAssertionCoverageReviewed must be true');
  }
  if (review.reviewScope.executableAdapterCodeIncluded) {
    blockers.push('executableAdapterCodeIncluded must be false');
  }
  return blockers;
}

function sqlSafetyBlockers(review: GslrPersistentStaticRepositoryDraftSqlReviewV1): string[] {
  const blockers: string[] = [];
  if (review.sqlSafety.statementMode !== 'draft-not-executable') {
    blockers.push('statementMode must be draft-not-executable');
  }
  if (!review.sqlSafety.parameterizedStatements) {
    blockers.push('parameterizedStatements must be true');
  }
  if (review.sqlSafety.rawPayloadColumn !== 'absent') {
    blockers.push('rawPayloadColumn must be absent');
  }
  if (review.sqlSafety.productionDdl !== 'absent') {
    blockers.push('productionDdl must be absent');
  }
  if (review.sqlSafety.productionDml !== 'absent') {
    blockers.push('productionDml must be absent');
  }
  if (review.sqlSafety.connectionConfig !== 'absent') {
    blockers.push('connectionConfig must be absent');
  }
  return blockers;
}

function reviewerDecisionBlockers(
  review: GslrPersistentStaticRepositoryDraftSqlReviewV1,
): string[] {
  const blockers: string[] = [];
  for (const [role, decision] of Object.entries(review.reviewerDecision)) {
    if (decision !== 'approve-next-design-review') {
      blockers.push(`${role} must approve-next-design-review`);
    }
  }
  return blockers;
}

function authorityBlockers(review: GslrPersistentStaticRepositoryDraftSqlReviewV1): string[] {
  const blockers: string[] = [];
  if (review.authority.livePromptLanguagePolling !== 'blocked') {
    blockers.push('livePromptLanguagePolling must be blocked');
  }
  if (review.authority.queues !== 'absent') {
    blockers.push('queues must be absent');
  }
  if (review.authority.sseStreams !== 'absent') {
    blockers.push('sseStreams must be absent');
  }
  if (review.authority.runtimeCards !== 'absent') {
    blockers.push('runtimeCards must be absent');
  }
  if (review.authority.productionActions !== 'blocked') {
    blockers.push('productionActions must be blocked');
  }
  if (review.authority.mcConnectorAccess !== 'blocked') {
    blockers.push('mcConnectorAccess must be blocked');
  }
  return blockers;
}

function assertSchemaVersion(review: GslrPersistentStaticRepositoryDraftSqlReviewV1) {
  if (
    review.schemaVersion !== GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_SQL_REVIEW_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_SQL_REVIEW_V1_SCHEMA_VERSION}`,
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
