import type {
  GslrPersistentStaticRepositoryDatabaseAdapterReviewResultV1,
  GslrPersistentStaticRepositoryDatabaseAdapterReviewStatusV1,
} from './gslr-persistent-static-repository-database-adapter-review-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_POSTGRES_ADAPTER_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-draft-postgres-adapter.v1' as const;

export type GslrPersistentStaticRepositoryDraftPostgresAdapterStatusV1 =
  | 'ready-for-draft-adapter-code-review'
  | 'blocked';

export type GslrPersistentStaticRepositoryDraftPostgresStatementV1 =
  | 'append-static-imported-record'
  | 'append-audit-event'
  | 'get-static-imported-record'
  | 'list-static-imported-records'
  | 'transition-review-state'
  | 'audit-trail-for-static-imported-record';

export type GslrPersistentStaticRepositoryDraftPostgresAdapterV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_POSTGRES_ADAPTER_V1_SCHEMA_VERSION;
  reviewCheckpoint: Readonly<{
    status: GslrPersistentStaticRepositoryDatabaseAdapterReviewStatusV1;
    blockers: readonly string[];
    reviewNeeds: readonly string[];
    decisionNotes: readonly string[];
  }>;
  adapter: Readonly<{
    kind: 'draft-postgres-adapter' | 'production-postgres-adapter';
    implementationMode: 'contract-scaffold-only' | 'executable-database-adapter';
    connectionConfig: 'absent' | 'present';
    migrationStatus: 'draft-not-applied' | 'applied';
    productionTablesCreated: boolean;
    productionWritesEnabled: boolean;
  }>;
  sqlPlan: Readonly<{
    statementMode: 'draft-not-executable' | 'executable';
    parameterizedStatements: boolean;
    tables: readonly string[];
    rawPayloadColumn: 'absent' | 'present';
    constraints: readonly string[];
    rollbackPlan: 'documented-drop-draft-only' | 'missing' | 'production-rollback';
    statements: readonly GslrPersistentStaticRepositoryDraftPostgresStatementV1[];
  }>;
  contractAssertions: Readonly<{
    appendAcceptedRecord: 'planned' | 'missing';
    idempotentReplay: 'planned' | 'missing';
    idempotencyConflict: 'planned' | 'missing';
    recordIdConflict: 'planned' | 'missing';
    canonicalFingerprint: 'planned' | 'missing';
    rawPayloadRejected: 'planned' | 'missing';
    constrainedReviewTransition: 'planned' | 'missing';
    auditTrailAppendOnly: 'planned' | 'missing';
    missingRecordRead: 'planned' | 'missing';
    forbiddenRuntimeOperationsAbsent: 'planned' | 'missing';
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

export type GslrPersistentStaticRepositoryDraftPostgresAdapterResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_POSTGRES_ADAPTER_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryDraftPostgresAdapterStatusV1;
  blockers: readonly string[];
  scaffoldArtifacts: readonly string[];
  nextReviewChecks: readonly string[];
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryDraftPostgresAdapterV1(
  reviewCheckpoint: GslrPersistentStaticRepositoryDatabaseAdapterReviewResultV1,
): GslrPersistentStaticRepositoryDraftPostgresAdapterV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_POSTGRES_ADAPTER_V1_SCHEMA_VERSION,
    reviewCheckpoint: {
      status: reviewCheckpoint.status,
      blockers: reviewCheckpoint.blockers,
      reviewNeeds: reviewCheckpoint.reviewNeeds,
      decisionNotes: reviewCheckpoint.decisionNotes,
    },
    adapter: {
      kind: 'draft-postgres-adapter',
      implementationMode: 'contract-scaffold-only',
      connectionConfig: 'absent',
      migrationStatus: 'draft-not-applied',
      productionTablesCreated: false,
      productionWritesEnabled: false,
    },
    sqlPlan: {
      statementMode: 'draft-not-executable',
      parameterizedStatements: true,
      tables: ['gslr_static_imported_records', 'gslr_static_imported_record_audit_events'],
      rawPayloadColumn: 'absent',
      constraints: [
        'unique(idempotency_key)',
        'unique(record_id)',
        'check(record_fingerprint_sha256 = sha256(canonical_json(record)))',
        'check(raw_payload is absent)',
        'check(review_state in constrained_static_review_states)',
      ],
      rollbackPlan: 'documented-drop-draft-only',
      statements: [
        'append-static-imported-record',
        'append-audit-event',
        'get-static-imported-record',
        'list-static-imported-records',
        'transition-review-state',
        'audit-trail-for-static-imported-record',
      ],
    },
    contractAssertions: {
      appendAcceptedRecord: 'planned',
      idempotentReplay: 'planned',
      idempotencyConflict: 'planned',
      recordIdConflict: 'planned',
      canonicalFingerprint: 'planned',
      rawPayloadRejected: 'planned',
      constrainedReviewTransition: 'planned',
      auditTrailAppendOnly: 'planned',
      missingRecordRead: 'planned',
      forbiddenRuntimeOperationsAbsent: 'planned',
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

export function evaluateGslrPersistentStaticRepositoryDraftPostgresAdapterV1(
  adapter: GslrPersistentStaticRepositoryDraftPostgresAdapterV1,
): GslrPersistentStaticRepositoryDraftPostgresAdapterResultV1 {
  assertSchemaVersion(adapter);
  const blockers = [
    ...reviewCheckpointBlockers(adapter),
    ...adapterBlockers(adapter),
    ...sqlPlanBlockers(adapter),
    ...contractAssertionBlockers(adapter),
    ...authorityBlockers(adapter),
  ];

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_POSTGRES_ADAPTER_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-for-draft-adapter-code-review' : 'blocked',
    blockers,
    scaffoldArtifacts: [
      'review-gated draft PostgreSQL adapter scaffold',
      'non-executable parameterized SQL plan',
      'static imported record table mapping',
      'append-only audit event table mapping',
      'idempotency, record ID, fingerprint, raw payload, and review-state constraint plan',
      'contract assertion plan for the GSLR-27 adapter cases',
      'no-runtime authority guard list',
    ],
    nextReviewChecks: [
      'review SQL mapping before any executable adapter code',
      'keep connection configuration absent until a separate approval bead',
      'keep migrations unapplied and production writes disabled',
      'run the GSLR-27 adapter contract cases against any executable database adapter',
      'keep live polling, queues, SSE, runtime cards, actions, and MC connector access blocked',
    ],
    boundaryWarnings: [
      'This draft PostgreSQL adapter is a contract scaffold only.',
      'It does not create a database connection, apply migrations, create production tables, or write production state.',
      'It does not poll prompt-language manifests, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
    ],
  });
}

function reviewCheckpointBlockers(
  adapter: GslrPersistentStaticRepositoryDraftPostgresAdapterV1,
): string[] {
  if (adapter.reviewCheckpoint.status === 'ready-to-open-draft-postgres-adapter-bead') return [];
  return [
    'reviewCheckpoint status must be ready-to-open-draft-postgres-adapter-bead',
    ...adapter.reviewCheckpoint.blockers.map((blocker) => `review checkpoint blocker: ${blocker}`),
    ...adapter.reviewCheckpoint.reviewNeeds.map((need) => `review checkpoint need: ${need}`),
    ...adapter.reviewCheckpoint.decisionNotes.map((note) => `review checkpoint decision: ${note}`),
  ];
}

function adapterBlockers(adapter: GslrPersistentStaticRepositoryDraftPostgresAdapterV1): string[] {
  const blockers: string[] = [];
  if (adapter.adapter.kind !== 'draft-postgres-adapter') {
    blockers.push('adapter kind must be draft-postgres-adapter');
  }
  if (adapter.adapter.implementationMode !== 'contract-scaffold-only') {
    blockers.push('adapter implementationMode must be contract-scaffold-only');
  }
  if (adapter.adapter.connectionConfig !== 'absent') {
    blockers.push('adapter connectionConfig must be absent');
  }
  if (adapter.adapter.migrationStatus !== 'draft-not-applied') {
    blockers.push('adapter migrationStatus must be draft-not-applied');
  }
  if (adapter.adapter.productionTablesCreated) {
    blockers.push('adapter productionTablesCreated must be false');
  }
  if (adapter.adapter.productionWritesEnabled) {
    blockers.push('adapter productionWritesEnabled must be false');
  }
  return blockers;
}

function sqlPlanBlockers(adapter: GslrPersistentStaticRepositoryDraftPostgresAdapterV1): string[] {
  const blockers: string[] = [];
  if (adapter.sqlPlan.statementMode !== 'draft-not-executable') {
    blockers.push('sqlPlan statementMode must be draft-not-executable');
  }
  if (!adapter.sqlPlan.parameterizedStatements) {
    blockers.push('sqlPlan parameterizedStatements must be true');
  }
  for (const table of [
    'gslr_static_imported_records',
    'gslr_static_imported_record_audit_events',
  ]) {
    if (!adapter.sqlPlan.tables.includes(table)) {
      blockers.push(`sqlPlan table ${table} must be listed`);
    }
  }
  if (adapter.sqlPlan.rawPayloadColumn !== 'absent') {
    blockers.push('sqlPlan rawPayloadColumn must be absent');
  }
  for (const constraint of [
    'unique(idempotency_key)',
    'unique(record_id)',
    'check(record_fingerprint_sha256 = sha256(canonical_json(record)))',
    'check(raw_payload is absent)',
    'check(review_state in constrained_static_review_states)',
  ]) {
    if (!adapter.sqlPlan.constraints.includes(constraint)) {
      blockers.push(`sqlPlan constraint ${constraint} must be listed`);
    }
  }
  if (adapter.sqlPlan.rollbackPlan !== 'documented-drop-draft-only') {
    blockers.push('sqlPlan rollbackPlan must be documented-drop-draft-only');
  }
  for (const statement of requiredStatements) {
    if (!adapter.sqlPlan.statements.includes(statement)) {
      blockers.push(`sqlPlan statement ${statement} must be listed`);
    }
  }
  return blockers;
}

function contractAssertionBlockers(
  adapter: GslrPersistentStaticRepositoryDraftPostgresAdapterV1,
): string[] {
  return (
    Object.entries(adapter.contractAssertions) as [
      keyof typeof adapter.contractAssertions,
      string,
    ][]
  )
    .filter(([, status]) => status !== 'planned')
    .map(([key]) => `contract assertion ${key} must be planned`);
}

function authorityBlockers(
  adapter: GslrPersistentStaticRepositoryDraftPostgresAdapterV1,
): string[] {
  const blockers: string[] = [];
  if (adapter.authority.livePromptLanguagePolling !== 'blocked') {
    blockers.push('livePromptLanguagePolling must be blocked');
  }
  if (adapter.authority.queues !== 'absent') {
    blockers.push('queues must be absent');
  }
  if (adapter.authority.sseStreams !== 'absent') {
    blockers.push('sseStreams must be absent');
  }
  if (adapter.authority.runtimeCards !== 'absent') {
    blockers.push('runtimeCards must be absent');
  }
  if (adapter.authority.productionActions !== 'blocked') {
    blockers.push('productionActions must be blocked');
  }
  if (adapter.authority.mcConnectorAccess !== 'blocked') {
    blockers.push('mcConnectorAccess must be blocked');
  }
  return blockers;
}

const requiredStatements: readonly GslrPersistentStaticRepositoryDraftPostgresStatementV1[] = [
  'append-static-imported-record',
  'append-audit-event',
  'get-static-imported-record',
  'list-static-imported-records',
  'transition-review-state',
  'audit-trail-for-static-imported-record',
];

function assertSchemaVersion(adapter: GslrPersistentStaticRepositoryDraftPostgresAdapterV1) {
  if (
    adapter.schemaVersion !==
    GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_POSTGRES_ADAPTER_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_POSTGRES_ADAPTER_V1_SCHEMA_VERSION}`,
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
