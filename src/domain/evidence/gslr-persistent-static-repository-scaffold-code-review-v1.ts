import type {
  GslrPersistentStaticRepositoryExecutableAdapterScaffoldResultV1,
  GslrPersistentStaticRepositoryExecutableAdapterScaffoldStatusV1,
} from './gslr-persistent-static-repository-executable-adapter-scaffold-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_SCAFFOLD_CODE_REVIEW_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-scaffold-code-review.v1' as const;

export type GslrPersistentStaticRepositoryScaffoldCodeReviewStatusV1 =
  | 'ready-to-open-unbound-adapter-shell-bead'
  | 'blocked';

export type GslrPersistentStaticRepositoryScaffoldCodeReviewV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_SCAFFOLD_CODE_REVIEW_V1_SCHEMA_VERSION;
  scaffold: Readonly<{
    status: GslrPersistentStaticRepositoryExecutableAdapterScaffoldStatusV1;
    blockers: readonly string[];
  }>;
  reviewedEvidence: Readonly<{
    adapterShellReviewed: boolean;
    portMethodSurfaceReviewed: boolean;
    transactionBoundaryStillUnbound: boolean;
    contractHarnessStillPlannedOnly: boolean;
    boundaryWarningsReviewed: boolean;
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
    engineeringDecision: 'approve-unbound-adapter-shell' | 'request-changes';
    securityDecision: 'approve-unbound-adapter-shell' | 'request-changes';
    operationsDecision: 'approve-unbound-adapter-shell' | 'request-changes';
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

export type GslrPersistentStaticRepositoryScaffoldCodeReviewResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_SCAFFOLD_CODE_REVIEW_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryScaffoldCodeReviewStatusV1;
  blockers: readonly string[];
  reviewedEvidence: readonly string[];
  recommendedNextBead: string;
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryScaffoldCodeReviewV1(
  scaffold: GslrPersistentStaticRepositoryExecutableAdapterScaffoldResultV1,
): GslrPersistentStaticRepositoryScaffoldCodeReviewV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_SCAFFOLD_CODE_REVIEW_V1_SCHEMA_VERSION,
    scaffold: {
      status: scaffold.status,
      blockers: scaffold.blockers,
    },
    reviewedEvidence: {
      adapterShellReviewed: true,
      portMethodSurfaceReviewed: true,
      transactionBoundaryStillUnbound: true,
      contractHarnessStillPlannedOnly: true,
      boundaryWarningsReviewed: true,
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
      engineeringDecision: 'approve-unbound-adapter-shell',
      securityDecision: 'approve-unbound-adapter-shell',
      operationsDecision: 'approve-unbound-adapter-shell',
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

export function evaluateGslrPersistentStaticRepositoryScaffoldCodeReviewV1(
  review: GslrPersistentStaticRepositoryScaffoldCodeReviewV1,
): GslrPersistentStaticRepositoryScaffoldCodeReviewResultV1 {
  assertSchemaVersion(review);
  const blockers = [
    ...scaffoldBlockers(review),
    ...reviewedEvidenceBlockers(review),
    ...forbiddenArtifactBlockers(review),
    ...reviewDecisionBlockers(review),
    ...authorityBlockers(review),
  ];

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_SCAFFOLD_CODE_REVIEW_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-to-open-unbound-adapter-shell-bead' : 'blocked',
    blockers,
    reviewedEvidence: [
      'adapter shell reviewed',
      'port method surface reviewed',
      'transaction boundary still unbound',
      'contract harness still planned only',
      'boundary warnings reviewed',
    ],
    recommendedNextBead:
      blockers.length === 0
        ? 'Open an unbound adapter shell bead with no database client, connection config, generated SQL, secrets, migrations, production tables, reads, writes, runtime cards, actions, or MC connector access.'
        : 'Resolve scaffold code-review blockers before opening unbound shell work.',
    boundaryWarnings: [
      'This code-review evidence verifies the scaffold remains unbound.',
      'It does not authorize database client binding, connection configuration, generated SQL, secrets, migrations, production tables, reads, or writes.',
      'It does not poll prompt-language manifests, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
    ],
  });
}

function scaffoldBlockers(review: GslrPersistentStaticRepositoryScaffoldCodeReviewV1): string[] {
  if (review.scaffold.status === 'ready-for-scaffold-code-review') return [];
  return [
    'scaffold status must be ready-for-scaffold-code-review',
    ...review.scaffold.blockers.map((blocker) => `scaffold blocker: ${blocker}`),
  ];
}

function reviewedEvidenceBlockers(
  review: GslrPersistentStaticRepositoryScaffoldCodeReviewV1,
): string[] {
  return (
    Object.entries(review.reviewedEvidence) as [keyof typeof review.reviewedEvidence, boolean][]
  )
    .filter(([, value]) => !value)
    .map(([key]) => `${key} must be true`);
}

function forbiddenArtifactBlockers(
  review: GslrPersistentStaticRepositoryScaffoldCodeReviewV1,
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
  review: GslrPersistentStaticRepositoryScaffoldCodeReviewV1,
): string[] {
  const blockers: string[] = [];
  for (const [role, decision] of Object.entries(review.reviewDecision)) {
    if (decision !== 'approve-unbound-adapter-shell') {
      blockers.push(`${role} must approve-unbound-adapter-shell`);
    }
  }
  return blockers;
}

function authorityBlockers(review: GslrPersistentStaticRepositoryScaffoldCodeReviewV1): string[] {
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

function assertSchemaVersion(review: GslrPersistentStaticRepositoryScaffoldCodeReviewV1) {
  if (
    review.schemaVersion !==
    GSLR_PERSISTENT_STATIC_REPOSITORY_SCAFFOLD_CODE_REVIEW_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_SCAFFOLD_CODE_REVIEW_V1_SCHEMA_VERSION}`,
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
