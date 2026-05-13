import type {
  GslrPersistentStaticRepositoryReviewPacketResultV1,
  GslrPersistentStaticRepositoryReviewPacketStatusV1,
} from './gslr-persistent-static-repository-review-packet-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-implementation.v1' as const;

export type GslrPersistentStaticRepositoryImplementationStatusV1 =
  | 'ready-for-code-review'
  | 'blocked';

export type GslrPersistentStaticRepositoryPortOperationV1 =
  | 'appendStaticImportedRecord'
  | 'getStaticImportedRecord'
  | 'listStaticImportedRecords'
  | 'transitionStaticImportedRecordReviewState'
  | 'auditTrailForStaticImportedRecord';

export type GslrPersistentStaticRepositoryForbiddenOperationV1 =
  | 'updateStaticImportedRecord'
  | 'deleteStaticImportedRecord'
  | 'pollPromptLanguage'
  | 'subscribeRuntimeCards'
  | 'executeAction'
  | 'readMcConnector';

export type GslrPersistentStaticRepositoryImplementationV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_V1_SCHEMA_VERSION;
  reviewPacket: Readonly<{
    status: GslrPersistentStaticRepositoryReviewPacketStatusV1;
    blockers: readonly string[];
  }>;
  repositoryPort: Readonly<{
    operations: readonly GslrPersistentStaticRepositoryPortOperationV1[];
    forbiddenOperations: readonly GslrPersistentStaticRepositoryForbiddenOperationV1[];
    appendSemantics: 'append-only';
    idempotency: 'required-unique-key';
    recordFingerprint: 'canonical-json-sha256-required';
    rawPayloadStorage: 'forbidden';
    reviewTransitions: 'constrained-with-actor-and-reason';
  }>;
  draftMigration: Readonly<{
    status: 'draft-not-applied' | 'applied' | 'missing';
    productionTablesCreated: boolean;
    productionWritesEnabled: boolean;
    tables: readonly string[];
    constraints: readonly string[];
    auditEvents: 'append-only-table' | 'missing' | 'mutable-table';
    rollbackPlan: 'documented-drop-draft-only' | 'missing' | 'destructive-production-rollback';
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

export type GslrPersistentStaticRepositoryImplementationResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryImplementationStatusV1;
  blockers: readonly string[];
  implementedArtifacts: readonly string[];
  nextReviewChecks: readonly string[];
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryImplementationV1(
  reviewPacket: GslrPersistentStaticRepositoryReviewPacketResultV1,
): GslrPersistentStaticRepositoryImplementationV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_V1_SCHEMA_VERSION,
    reviewPacket: {
      status: reviewPacket.status,
      blockers: reviewPacket.blockers,
    },
    repositoryPort: {
      operations: [
        'appendStaticImportedRecord',
        'getStaticImportedRecord',
        'listStaticImportedRecords',
        'transitionStaticImportedRecordReviewState',
        'auditTrailForStaticImportedRecord',
      ],
      forbiddenOperations: [
        'updateStaticImportedRecord',
        'deleteStaticImportedRecord',
        'pollPromptLanguage',
        'subscribeRuntimeCards',
        'executeAction',
        'readMcConnector',
      ],
      appendSemantics: 'append-only',
      idempotency: 'required-unique-key',
      recordFingerprint: 'canonical-json-sha256-required',
      rawPayloadStorage: 'forbidden',
      reviewTransitions: 'constrained-with-actor-and-reason',
    },
    draftMigration: {
      status: 'draft-not-applied',
      productionTablesCreated: false,
      productionWritesEnabled: false,
      tables: ['gslr_static_imported_records', 'gslr_static_imported_record_audit_events'],
      constraints: [
        'unique(idempotency_key)',
        'unique(record_id)',
        'check(record_fingerprint_sha256 = sha256(canonical_json(record)))',
        'check(raw_payload is null)',
        'check(review_state in constrained_static_review_states)',
      ],
      auditEvents: 'append-only-table',
      rollbackPlan: 'documented-drop-draft-only',
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

export function evaluateGslrPersistentStaticRepositoryImplementationV1(
  implementation: GslrPersistentStaticRepositoryImplementationV1,
): GslrPersistentStaticRepositoryImplementationResultV1 {
  assertSchemaVersion(implementation);
  const blockers = [
    ...reviewPacketBlockers(implementation),
    ...repositoryPortBlockers(implementation),
    ...draftMigrationBlockers(implementation),
    ...authorityBlockers(implementation),
  ];

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-for-code-review' : 'blocked',
    blockers,
    implementedArtifacts: [
      'persistent static repository port specification',
      'append-only static imported record table draft',
      'append-only static imported record audit event table draft',
      'idempotency and record fingerprint constraints',
      'raw payload prohibition constraint',
      'constrained review transition contract',
      'no-runtime authority guard list',
    ],
    nextReviewChecks: [
      'review the port shape before any adapter code',
      'review the draft migration before applying it anywhere',
      'add adapter contract tests before production database wiring',
      'keep runtime ingestion, queues, SSE, actions, and MC connector access blocked',
    ],
    boundaryWarnings: [
      'This implementation artifact is a port and draft migration contract only.',
      'It does not apply migrations, create production tables, write production state, poll prompt-language manifests, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
      'A future adapter bead must pass this contract before any production persistence is enabled.',
    ],
  });
}

function reviewPacketBlockers(
  implementation: GslrPersistentStaticRepositoryImplementationV1,
): string[] {
  if (implementation.reviewPacket.status === 'ready-to-open-implementation-bead') return [];
  return [
    'reviewPacket status must be ready-to-open-implementation-bead',
    ...implementation.reviewPacket.blockers.map((blocker) => `review packet blocker: ${blocker}`),
  ];
}

function repositoryPortBlockers(
  implementation: GslrPersistentStaticRepositoryImplementationV1,
): string[] {
  const blockers: string[] = [];
  const requiredOperations: readonly GslrPersistentStaticRepositoryPortOperationV1[] = [
    'appendStaticImportedRecord',
    'getStaticImportedRecord',
    'listStaticImportedRecords',
    'transitionStaticImportedRecordReviewState',
    'auditTrailForStaticImportedRecord',
  ];
  for (const operation of requiredOperations) {
    if (!implementation.repositoryPort.operations.includes(operation)) {
      blockers.push(`repositoryPort operation ${operation} must be present`);
    }
  }
  if (implementation.repositoryPort.forbiddenOperations.length !== 6) {
    blockers.push('repositoryPort forbiddenOperations must list all forbidden runtime paths');
  }
  if (implementation.repositoryPort.appendSemantics !== 'append-only') {
    blockers.push('repositoryPort appendSemantics must be append-only');
  }
  if (implementation.repositoryPort.idempotency !== 'required-unique-key') {
    blockers.push('repositoryPort idempotency must be required-unique-key');
  }
  if (implementation.repositoryPort.recordFingerprint !== 'canonical-json-sha256-required') {
    blockers.push('repositoryPort recordFingerprint must be canonical-json-sha256-required');
  }
  if (implementation.repositoryPort.rawPayloadStorage !== 'forbidden') {
    blockers.push('repositoryPort rawPayloadStorage must be forbidden');
  }
  if (implementation.repositoryPort.reviewTransitions !== 'constrained-with-actor-and-reason') {
    blockers.push('repositoryPort reviewTransitions must be constrained-with-actor-and-reason');
  }
  return blockers;
}

function draftMigrationBlockers(
  implementation: GslrPersistentStaticRepositoryImplementationV1,
): string[] {
  const blockers: string[] = [];
  if (implementation.draftMigration.status !== 'draft-not-applied') {
    blockers.push('draftMigration status must be draft-not-applied');
  }
  if (implementation.draftMigration.productionTablesCreated) {
    blockers.push('draftMigration productionTablesCreated must be false');
  }
  if (implementation.draftMigration.productionWritesEnabled) {
    blockers.push('draftMigration productionWritesEnabled must be false');
  }
  for (const table of [
    'gslr_static_imported_records',
    'gslr_static_imported_record_audit_events',
  ]) {
    if (!implementation.draftMigration.tables.includes(table)) {
      blockers.push(`draftMigration table ${table} must be listed`);
    }
  }
  for (const constraint of [
    'unique(idempotency_key)',
    'unique(record_id)',
    'check(record_fingerprint_sha256 = sha256(canonical_json(record)))',
    'check(raw_payload is null)',
    'check(review_state in constrained_static_review_states)',
  ]) {
    if (!implementation.draftMigration.constraints.includes(constraint)) {
      blockers.push(`draftMigration constraint ${constraint} must be listed`);
    }
  }
  if (implementation.draftMigration.auditEvents !== 'append-only-table') {
    blockers.push('draftMigration auditEvents must be append-only-table');
  }
  if (implementation.draftMigration.rollbackPlan !== 'documented-drop-draft-only') {
    blockers.push('draftMigration rollbackPlan must be documented-drop-draft-only');
  }
  return blockers;
}

function authorityBlockers(
  implementation: GslrPersistentStaticRepositoryImplementationV1,
): string[] {
  const blockers: string[] = [];
  if (implementation.authority.livePromptLanguagePolling !== 'blocked') {
    blockers.push('livePromptLanguagePolling must be blocked');
  }
  if (implementation.authority.queues !== 'absent') {
    blockers.push('queues must be absent');
  }
  if (implementation.authority.sseStreams !== 'absent') {
    blockers.push('sseStreams must be absent');
  }
  if (implementation.authority.runtimeCards !== 'absent') {
    blockers.push('runtimeCards must be absent');
  }
  if (implementation.authority.productionActions !== 'blocked') {
    blockers.push('productionActions must be blocked');
  }
  if (implementation.authority.mcConnectorAccess !== 'blocked') {
    blockers.push('mcConnectorAccess must be blocked');
  }
  return blockers;
}

function assertSchemaVersion(implementation: GslrPersistentStaticRepositoryImplementationV1) {
  if (
    implementation.schemaVersion !==
    GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_V1_SCHEMA_VERSION}`,
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
