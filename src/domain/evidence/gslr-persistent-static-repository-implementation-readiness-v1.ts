import type {
  GslrPersistentStaticImportedRecordStorageDesignStatusV1,
  GslrPersistentStaticImportedRecordStorageDesignV1,
} from './gslr-persistent-static-imported-record-storage-design-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_READINESS_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-implementation-readiness.v1' as const;

export type GslrPersistentStaticRepositoryImplementationReadinessStatusV1 =
  | 'ready-to-open-implementation-bead'
  | 'blocked';

export type GslrPersistentStaticRepositoryImplementationReadinessV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_READINESS_V1_SCHEMA_VERSION;
  storageDesign: Readonly<{
    status: GslrPersistentStaticImportedRecordStorageDesignStatusV1;
    design: GslrPersistentStaticImportedRecordStorageDesignV1;
  }>;
  implementationState: Readonly<{
    databaseMigrations: 'not-started' | 'applied';
    productionTables: 'absent' | 'present';
    productionWrites: 'absent' | 'present';
  }>;
  contractPlan: Readonly<{
    repositoryPort: 'specified' | 'missing';
    appendOnlySchema: 'specified' | 'missing';
    idempotencyUniqueConstraint: 'specified' | 'missing';
    recordFingerprintConstraint: 'specified' | 'missing';
    auditEventSchema: 'specified' | 'missing';
    reviewStateTransitionTable: 'specified' | 'missing';
  }>;
  operationalPlan: Readonly<{
    migrationPlan: 'drafted-not-applied' | 'missing' | 'applied';
    backupRestorePlan: 'drafted' | 'missing';
    observabilityPlan: 'drafted-static-only' | 'missing' | 'live-streaming';
    retentionPlan: 'drafted-delete-prohibited' | 'missing' | 'delete-allowed';
  }>;
  securityPlan: Readonly<{
    verificationGateDependency: 'documented' | 'missing';
    rawPayloadStoragePolicy: 'forbidden' | 'allowed';
    runtimeAuthorityPolicy: 'none' | 'route-decision' | 'action-execution';
    mcConnectorAccessPolicy: 'blocked' | 'allowed';
  }>;
}>;

export type GslrPersistentStaticRepositoryImplementationReadinessResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_READINESS_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryImplementationReadinessStatusV1;
  blockers: readonly string[];
  requiredImplementationArtifacts: readonly string[];
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryImplementationReadinessV1(
  storageDesign: GslrPersistentStaticImportedRecordStorageDesignV1,
): GslrPersistentStaticRepositoryImplementationReadinessV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_READINESS_V1_SCHEMA_VERSION,
    storageDesign: {
      status: 'ready-for-persistent-static-storage-design',
      design: storageDesign,
    },
    implementationState: {
      databaseMigrations: 'not-started',
      productionTables: 'absent',
      productionWrites: 'absent',
    },
    contractPlan: {
      repositoryPort: 'specified',
      appendOnlySchema: 'specified',
      idempotencyUniqueConstraint: 'specified',
      recordFingerprintConstraint: 'specified',
      auditEventSchema: 'specified',
      reviewStateTransitionTable: 'specified',
    },
    operationalPlan: {
      migrationPlan: 'drafted-not-applied',
      backupRestorePlan: 'drafted',
      observabilityPlan: 'drafted-static-only',
      retentionPlan: 'drafted-delete-prohibited',
    },
    securityPlan: {
      verificationGateDependency: 'documented',
      rawPayloadStoragePolicy: 'forbidden',
      runtimeAuthorityPolicy: 'none',
      mcConnectorAccessPolicy: 'blocked',
    },
  });
}

export function evaluateGslrPersistentStaticRepositoryImplementationReadinessV1(
  checklist: GslrPersistentStaticRepositoryImplementationReadinessV1,
): GslrPersistentStaticRepositoryImplementationReadinessResultV1 {
  assertSchemaVersion(checklist);
  const blockers = [
    ...storageDesignBlockers(checklist),
    ...implementationStateBlockers(checklist),
    ...contractPlanBlockers(checklist),
    ...operationalPlanBlockers(checklist),
    ...securityPlanBlockers(checklist),
  ];

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_READINESS_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-to-open-implementation-bead' : 'blocked',
    blockers,
    requiredImplementationArtifacts: [
      'repository port interface and contract tests',
      'append-only static record table migration draft',
      'idempotency unique constraint and replay behavior tests',
      'canonical JSON SHA-256 record fingerprint constraint tests',
      'append-only audit event table migration draft',
      'constrained review-state transition tests',
      'backup/restore and retention runbook',
      'static-only observability plan with no SSE or runtime cards',
      'verification-gate dependency check before writes',
    ],
    boundaryWarnings: [
      'Passing this checklist authorizes opening a future implementation bead only.',
      'This checklist does not apply migrations, create production tables, write production state, poll prompt-language manifests, create queues, open SSE streams, create runtime cards, make route decisions, execute actions, or access MC connectors.',
      'Any implementation bead must keep static imported records append-only and must reject runtime authority, action controls, raw payload storage, and MC connector access.',
    ],
  });
}

function storageDesignBlockers(
  checklist: GslrPersistentStaticRepositoryImplementationReadinessV1,
): string[] {
  const blockers: string[] = [];
  if (checklist.storageDesign.status !== 'ready-for-persistent-static-storage-design') {
    blockers.push('storageDesign status must be ready-for-persistent-static-storage-design');
  }
  if (checklist.storageDesign.design.storage.target !== 'append-only-static-record-store') {
    blockers.push('storageDesign target must be append-only-static-record-store');
  }
  return blockers;
}

function implementationStateBlockers(
  checklist: GslrPersistentStaticRepositoryImplementationReadinessV1,
): string[] {
  const blockers: string[] = [];
  if (checklist.implementationState.databaseMigrations !== 'not-started') {
    blockers.push('databaseMigrations must be not-started for readiness review');
  }
  if (checklist.implementationState.productionTables !== 'absent') {
    blockers.push('productionTables must be absent for readiness review');
  }
  if (checklist.implementationState.productionWrites !== 'absent') {
    blockers.push('productionWrites must be absent for readiness review');
  }
  return blockers;
}

function contractPlanBlockers(
  checklist: GslrPersistentStaticRepositoryImplementationReadinessV1,
): string[] {
  const required: (keyof GslrPersistentStaticRepositoryImplementationReadinessV1['contractPlan'])[] =
    [
      'repositoryPort',
      'appendOnlySchema',
      'idempotencyUniqueConstraint',
      'recordFingerprintConstraint',
      'auditEventSchema',
      'reviewStateTransitionTable',
    ];
  return required
    .filter((key) => checklist.contractPlan[key] !== 'specified')
    .map((key) => `contractPlan ${key} must be specified`);
}

function operationalPlanBlockers(
  checklist: GslrPersistentStaticRepositoryImplementationReadinessV1,
): string[] {
  const blockers: string[] = [];
  if (checklist.operationalPlan.migrationPlan !== 'drafted-not-applied') {
    blockers.push('operationalPlan migrationPlan must be drafted-not-applied');
  }
  if (checklist.operationalPlan.backupRestorePlan !== 'drafted') {
    blockers.push('operationalPlan backupRestorePlan must be drafted');
  }
  if (checklist.operationalPlan.observabilityPlan !== 'drafted-static-only') {
    blockers.push('operationalPlan observabilityPlan must be drafted-static-only');
  }
  if (checklist.operationalPlan.retentionPlan !== 'drafted-delete-prohibited') {
    blockers.push('operationalPlan retentionPlan must be drafted-delete-prohibited');
  }
  return blockers;
}

function securityPlanBlockers(
  checklist: GslrPersistentStaticRepositoryImplementationReadinessV1,
): string[] {
  const blockers: string[] = [];
  if (checklist.securityPlan.verificationGateDependency !== 'documented') {
    blockers.push('securityPlan verificationGateDependency must be documented');
  }
  if (checklist.securityPlan.rawPayloadStoragePolicy !== 'forbidden') {
    blockers.push('securityPlan rawPayloadStoragePolicy must be forbidden');
  }
  if (checklist.securityPlan.runtimeAuthorityPolicy !== 'none') {
    blockers.push('securityPlan runtimeAuthorityPolicy must be none');
  }
  if (checklist.securityPlan.mcConnectorAccessPolicy !== 'blocked') {
    blockers.push('securityPlan mcConnectorAccessPolicy must be blocked');
  }
  return blockers;
}

function assertSchemaVersion(checklist: GslrPersistentStaticRepositoryImplementationReadinessV1) {
  if (
    checklist.schemaVersion !==
    GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_READINESS_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_IMPLEMENTATION_READINESS_V1_SCHEMA_VERSION}`,
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
