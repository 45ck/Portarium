import type {
  GslrPersistentStaticRepositoryUnboundAdapterShellResultV1,
  GslrPersistentStaticRepositoryUnboundAdapterShellStatusV1,
} from './gslr-persistent-static-repository-unbound-adapter-shell-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_REVIEW_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-unbound-adapter-shell-review.v1' as const;

export type GslrPersistentStaticRepositoryUnboundAdapterShellReviewStatusV1 =
  | 'ready-to-open-database-binding-design-review-bead'
  | 'blocked';

export type GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_REVIEW_V1_SCHEMA_VERSION;
  unboundShell: Readonly<{
    status: GslrPersistentStaticRepositoryUnboundAdapterShellStatusV1;
    blockers: readonly string[];
  }>;
  reviewEvidence: Readonly<{
    portMethodsReviewed: boolean;
    constructorBoundaryReviewed: boolean;
    transactionBoundaryReviewed: boolean;
    notImplementedBodiesReviewed: boolean;
    errorMappingSurfaceReviewed: boolean;
    databaseBindingTodoReviewed: boolean;
    contractHarnessTodoReviewed: boolean;
  }>;
  forbiddenArtifacts: Readonly<{
    databaseClientBinding: 'absent' | 'present';
    connectionConfig: 'absent' | 'present';
    generatedSqlFiles: 'absent' | 'present';
    secretReferences: 'absent' | 'present';
    appliedMigrations: 'absent' | 'present';
    productionTables: 'absent' | 'present';
    readExecution: 'blocked' | 'enabled';
    writeExecution: 'blocked' | 'enabled';
  }>;
  reviewDecision: Readonly<{
    engineeringDecision: 'approve-database-binding-design-review' | 'request-changes';
    securityDecision: 'approve-database-binding-design-review' | 'request-changes';
    operationsDecision: 'approve-database-binding-design-review' | 'request-changes';
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

export type GslrPersistentStaticRepositoryUnboundAdapterShellReviewResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_REVIEW_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryUnboundAdapterShellReviewStatusV1;
  blockers: readonly string[];
  reviewedEvidence: readonly string[];
  recommendedNextBead: string;
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1(
  unboundShell: GslrPersistentStaticRepositoryUnboundAdapterShellResultV1,
): GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_REVIEW_V1_SCHEMA_VERSION,
    unboundShell: {
      status: unboundShell.status,
      blockers: unboundShell.blockers,
    },
    reviewEvidence: {
      portMethodsReviewed: true,
      constructorBoundaryReviewed: true,
      transactionBoundaryReviewed: true,
      notImplementedBodiesReviewed: true,
      errorMappingSurfaceReviewed: true,
      databaseBindingTodoReviewed: true,
      contractHarnessTodoReviewed: true,
    },
    forbiddenArtifacts: {
      databaseClientBinding: 'absent',
      connectionConfig: 'absent',
      generatedSqlFiles: 'absent',
      secretReferences: 'absent',
      appliedMigrations: 'absent',
      productionTables: 'absent',
      readExecution: 'blocked',
      writeExecution: 'blocked',
    },
    reviewDecision: {
      engineeringDecision: 'approve-database-binding-design-review',
      securityDecision: 'approve-database-binding-design-review',
      operationsDecision: 'approve-database-binding-design-review',
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

export function evaluateGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1(
  review: GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1,
): GslrPersistentStaticRepositoryUnboundAdapterShellReviewResultV1 {
  assertSchemaVersion(review);
  const blockers = [
    ...unboundShellBlockers(review),
    ...reviewEvidenceBlockers(review),
    ...forbiddenArtifactBlockers(review),
    ...reviewDecisionBlockers(review),
    ...authorityBlockers(review),
  ];

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_REVIEW_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-to-open-database-binding-design-review-bead' : 'blocked',
    blockers,
    reviewedEvidence: [
      'port methods reviewed',
      'constructor boundary reviewed',
      'transaction boundary reviewed',
      'not-implemented method bodies reviewed',
      'declared-only error mapping surface reviewed',
      'database binding TODO reviewed',
      'contract harness TODO reviewed',
    ],
    recommendedNextBead:
      blockers.length === 0
        ? 'Open a database-binding design-review bead before any database client, connection config, generated SQL, secrets, migrations, tables, reads, or writes.'
        : 'Resolve unbound adapter shell review blockers before database-binding design review.',
    boundaryWarnings: [
      'This review approves only database-binding design review as a next step.',
      'It does not authorize database client binding, connection configuration, generated SQL, secrets, applied migrations, production tables, reads, or writes.',
      'It does not poll prompt-language manifests, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
    ],
  });
}

function unboundShellBlockers(
  review: GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1,
): string[] {
  if (review.unboundShell.status === 'ready-for-unbound-adapter-shell-review') return [];
  return [
    'unboundShell status must be ready-for-unbound-adapter-shell-review',
    ...review.unboundShell.blockers.map((blocker) => `unbound shell blocker: ${blocker}`),
  ];
}

function reviewEvidenceBlockers(
  review: GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1,
): string[] {
  return (Object.entries(review.reviewEvidence) as [keyof typeof review.reviewEvidence, boolean][])
    .filter(([, value]) => !value)
    .map(([key]) => `${key} must be true`);
}

function forbiddenArtifactBlockers(
  review: GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1,
): string[] {
  const blockers: string[] = [];
  for (const key of [
    'databaseClientBinding',
    'connectionConfig',
    'generatedSqlFiles',
    'secretReferences',
    'appliedMigrations',
    'productionTables',
  ] as const) {
    if (review.forbiddenArtifacts[key] !== 'absent') {
      blockers.push(`${key} must be absent`);
    }
  }
  if (review.forbiddenArtifacts.readExecution !== 'blocked') {
    blockers.push('readExecution must be blocked');
  }
  if (review.forbiddenArtifacts.writeExecution !== 'blocked') {
    blockers.push('writeExecution must be blocked');
  }
  return blockers;
}

function reviewDecisionBlockers(
  review: GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1,
): string[] {
  const blockers: string[] = [];
  for (const [role, decision] of Object.entries(review.reviewDecision)) {
    if (decision !== 'approve-database-binding-design-review') {
      blockers.push(`${role} must approve-database-binding-design-review`);
    }
  }
  return blockers;
}

function authorityBlockers(
  review: GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1,
): string[] {
  const blockers: string[] = [];
  if (review.authority.livePromptLanguagePolling !== 'blocked') {
    blockers.push('livePromptLanguagePolling must be blocked');
  }
  if (review.authority.queues !== 'absent') blockers.push('queues must be absent');
  if (review.authority.sseStreams !== 'absent') blockers.push('sseStreams must be absent');
  if (review.authority.runtimeCards !== 'absent') blockers.push('runtimeCards must be absent');
  if (review.authority.productionActions !== 'blocked') {
    blockers.push('productionActions must be blocked');
  }
  if (review.authority.mcConnectorAccess !== 'blocked') {
    blockers.push('mcConnectorAccess must be blocked');
  }
  return blockers;
}

function assertSchemaVersion(review: GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1) {
  if (
    review.schemaVersion !==
    GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_REVIEW_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_REVIEW_V1_SCHEMA_VERSION}`,
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
