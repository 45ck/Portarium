import type {
  GslrPersistentStaticRepositoryDraftSqlReviewResultV1,
  GslrPersistentStaticRepositoryDraftSqlReviewStatusV1,
} from './gslr-persistent-static-repository-draft-sql-review-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_DESIGN_REVIEW_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-executable-adapter-design-review.v1' as const;

export type GslrPersistentStaticRepositoryExecutableAdapterDesignReviewStatusV1 =
  | 'ready-to-open-executable-adapter-scaffold-bead'
  | 'blocked';

export type GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_DESIGN_REVIEW_V1_SCHEMA_VERSION;
  sqlReview: Readonly<{
    status: GslrPersistentStaticRepositoryDraftSqlReviewStatusV1;
    blockers: readonly string[];
  }>;
  designScope: Readonly<{
    adapterInterfaceMapped: boolean;
    transactionBoundaryMapped: boolean;
    idempotencyReplayMapped: boolean;
    conflictErrorMappingReviewed: boolean;
    contractHarnessBindingReviewed: boolean;
    observabilityPlanReviewed: boolean;
    executableAdapterCodeIncluded: boolean;
  }>;
  implementationBoundary: Readonly<{
    implementationMode: 'design-review-only' | 'executable-adapter';
    connectionConfig: 'absent' | 'present';
    migrationStatus: 'draft-not-applied' | 'applied';
    productionTablesCreated: boolean;
    productionWritesEnabled: boolean;
    generatedSqlFiles: 'absent' | 'present';
    secretReferences: 'absent' | 'present';
  }>;
  reviewDecision: Readonly<{
    engineeringDecision: 'approve-scaffold-bead' | 'request-changes';
    securityDecision: 'approve-scaffold-bead' | 'request-changes';
    dataDecision: 'approve-scaffold-bead' | 'request-changes';
    operationsDecision: 'approve-scaffold-bead' | 'request-changes';
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

export type GslrPersistentStaticRepositoryExecutableAdapterDesignReviewResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_DESIGN_REVIEW_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryExecutableAdapterDesignReviewStatusV1;
  blockers: readonly string[];
  reviewedDesignArtifacts: readonly string[];
  recommendedNextBead: string;
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(
  sqlReview: GslrPersistentStaticRepositoryDraftSqlReviewResultV1,
): GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1 {
  return deepFreeze({
    schemaVersion:
      GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_DESIGN_REVIEW_V1_SCHEMA_VERSION,
    sqlReview: {
      status: sqlReview.status,
      blockers: sqlReview.blockers,
    },
    designScope: {
      adapterInterfaceMapped: true,
      transactionBoundaryMapped: true,
      idempotencyReplayMapped: true,
      conflictErrorMappingReviewed: true,
      contractHarnessBindingReviewed: true,
      observabilityPlanReviewed: true,
      executableAdapterCodeIncluded: false,
    },
    implementationBoundary: {
      implementationMode: 'design-review-only',
      connectionConfig: 'absent',
      migrationStatus: 'draft-not-applied',
      productionTablesCreated: false,
      productionWritesEnabled: false,
      generatedSqlFiles: 'absent',
      secretReferences: 'absent',
    },
    reviewDecision: {
      engineeringDecision: 'approve-scaffold-bead',
      securityDecision: 'approve-scaffold-bead',
      dataDecision: 'approve-scaffold-bead',
      operationsDecision: 'approve-scaffold-bead',
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

export function evaluateGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(
  review: GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
): GslrPersistentStaticRepositoryExecutableAdapterDesignReviewResultV1 {
  assertSchemaVersion(review);
  const blockers = [
    ...sqlReviewBlockers(review),
    ...designScopeBlockers(review),
    ...implementationBoundaryBlockers(review),
    ...reviewDecisionBlockers(review),
    ...authorityBlockers(review),
  ];

  return deepFreeze({
    schemaVersion:
      GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_DESIGN_REVIEW_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-to-open-executable-adapter-scaffold-bead' : 'blocked',
    blockers,
    reviewedDesignArtifacts: [
      'persistent static repository adapter interface mapping',
      'transaction boundary design for append and review transition operations',
      'idempotent replay and conflict error mapping design',
      'GSLR-27 contract harness binding plan',
      'static-only observability plan',
      'no-runtime authority guard list',
    ],
    recommendedNextBead:
      blockers.length === 0
        ? 'Open an executable adapter scaffold bead that still omits connection config, applied migrations, production tables, production writes, runtime cards, actions, and MC connector access.'
        : 'Resolve executable adapter design-review blockers before opening scaffold work.',
    boundaryWarnings: [
      'This review packet is design-only.',
      'It does not create executable adapter code, connection configuration, generated SQL files, database migrations, production tables, or production writes.',
      'It does not poll prompt-language manifests, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
    ],
  });
}

function sqlReviewBlockers(
  review: GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
): string[] {
  if (review.sqlReview.status === 'ready-for-executable-adapter-design-review') return [];
  return [
    'sqlReview status must be ready-for-executable-adapter-design-review',
    ...review.sqlReview.blockers.map((blocker) => `sql review blocker: ${blocker}`),
  ];
}

function designScopeBlockers(
  review: GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
): string[] {
  const blockers: string[] = [];
  if (!review.designScope.adapterInterfaceMapped) {
    blockers.push('adapterInterfaceMapped must be true');
  }
  if (!review.designScope.transactionBoundaryMapped) {
    blockers.push('transactionBoundaryMapped must be true');
  }
  if (!review.designScope.idempotencyReplayMapped) {
    blockers.push('idempotencyReplayMapped must be true');
  }
  if (!review.designScope.conflictErrorMappingReviewed) {
    blockers.push('conflictErrorMappingReviewed must be true');
  }
  if (!review.designScope.contractHarnessBindingReviewed) {
    blockers.push('contractHarnessBindingReviewed must be true');
  }
  if (!review.designScope.observabilityPlanReviewed) {
    blockers.push('observabilityPlanReviewed must be true');
  }
  if (review.designScope.executableAdapterCodeIncluded) {
    blockers.push('executableAdapterCodeIncluded must be false');
  }
  return blockers;
}

function implementationBoundaryBlockers(
  review: GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
): string[] {
  const blockers: string[] = [];
  if (review.implementationBoundary.implementationMode !== 'design-review-only') {
    blockers.push('implementationMode must be design-review-only');
  }
  if (review.implementationBoundary.connectionConfig !== 'absent') {
    blockers.push('connectionConfig must be absent');
  }
  if (review.implementationBoundary.migrationStatus !== 'draft-not-applied') {
    blockers.push('migrationStatus must be draft-not-applied');
  }
  if (review.implementationBoundary.productionTablesCreated) {
    blockers.push('productionTablesCreated must be false');
  }
  if (review.implementationBoundary.productionWritesEnabled) {
    blockers.push('productionWritesEnabled must be false');
  }
  if (review.implementationBoundary.generatedSqlFiles !== 'absent') {
    blockers.push('generatedSqlFiles must be absent');
  }
  if (review.implementationBoundary.secretReferences !== 'absent') {
    blockers.push('secretReferences must be absent');
  }
  return blockers;
}

function reviewDecisionBlockers(
  review: GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
): string[] {
  const blockers: string[] = [];
  for (const [role, decision] of Object.entries(review.reviewDecision)) {
    if (decision !== 'approve-scaffold-bead') {
      blockers.push(`${role} must approve-scaffold-bead`);
    }
  }
  return blockers;
}

function authorityBlockers(
  review: GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
): string[] {
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

function assertSchemaVersion(
  review: GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
) {
  if (
    review.schemaVersion !==
    GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_DESIGN_REVIEW_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_DESIGN_REVIEW_V1_SCHEMA_VERSION}`,
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
