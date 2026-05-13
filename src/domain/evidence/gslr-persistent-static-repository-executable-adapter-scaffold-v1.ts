import type {
  GslrPersistentStaticRepositoryExecutableAdapterDesignReviewResultV1,
  GslrPersistentStaticRepositoryExecutableAdapterDesignReviewStatusV1,
} from './gslr-persistent-static-repository-executable-adapter-design-review-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_SCAFFOLD_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-executable-adapter-scaffold.v1' as const;

export type GslrPersistentStaticRepositoryExecutableAdapterScaffoldStatusV1 =
  | 'ready-for-scaffold-code-review'
  | 'blocked';

export type GslrPersistentStaticRepositoryExecutableAdapterScaffoldMethodV1 =
  | 'appendStaticImportedRecord'
  | 'getStaticImportedRecord'
  | 'listStaticImportedRecords'
  | 'transitionStaticImportedRecordReviewState'
  | 'auditTrailForStaticImportedRecord';

export type GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_SCAFFOLD_V1_SCHEMA_VERSION;
  designReview: Readonly<{
    status: GslrPersistentStaticRepositoryExecutableAdapterDesignReviewStatusV1;
    blockers: readonly string[];
  }>;
  scaffold: Readonly<{
    adapterName: 'GslrPersistentStaticRepositoryPostgresAdapter';
    implementationMode: 'scaffold-only' | 'database-executable';
    portMethods: readonly GslrPersistentStaticRepositoryExecutableAdapterScaffoldMethodV1[];
    transactionBoundary: 'planned-not-bound' | 'bound';
    databaseClientBinding: 'absent' | 'present';
    connectionConfig: 'absent' | 'present';
    generatedSqlFiles: 'absent' | 'present';
    secretReferences: 'absent' | 'present';
  }>;
  persistenceBoundary: Readonly<{
    migrationStatus: 'draft-not-applied' | 'applied';
    productionTablesCreated: boolean;
    productionWritesEnabled: boolean;
    writeExecution: 'blocked' | 'enabled';
    readExecution: 'blocked' | 'enabled';
  }>;
  contractHarness: Readonly<{
    bindingMode: 'planned-not-executed' | 'executed-against-database';
    casesMapped: boolean;
    rawPayloadRejectionMapped: boolean;
    idempotencyConflictMapped: boolean;
    recordIdConflictMapped: boolean;
    auditAppendOnlyMapped: boolean;
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

export type GslrPersistentStaticRepositoryExecutableAdapterScaffoldResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_SCAFFOLD_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryExecutableAdapterScaffoldStatusV1;
  blockers: readonly string[];
  scaffoldArtifacts: readonly string[];
  recommendedNextBead: string;
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(
  designReview: GslrPersistentStaticRepositoryExecutableAdapterDesignReviewResultV1,
): GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_SCAFFOLD_V1_SCHEMA_VERSION,
    designReview: {
      status: designReview.status,
      blockers: designReview.blockers,
    },
    scaffold: {
      adapterName: 'GslrPersistentStaticRepositoryPostgresAdapter',
      implementationMode: 'scaffold-only',
      portMethods: [
        'appendStaticImportedRecord',
        'getStaticImportedRecord',
        'listStaticImportedRecords',
        'transitionStaticImportedRecordReviewState',
        'auditTrailForStaticImportedRecord',
      ],
      transactionBoundary: 'planned-not-bound',
      databaseClientBinding: 'absent',
      connectionConfig: 'absent',
      generatedSqlFiles: 'absent',
      secretReferences: 'absent',
    },
    persistenceBoundary: {
      migrationStatus: 'draft-not-applied',
      productionTablesCreated: false,
      productionWritesEnabled: false,
      writeExecution: 'blocked',
      readExecution: 'blocked',
    },
    contractHarness: {
      bindingMode: 'planned-not-executed',
      casesMapped: true,
      rawPayloadRejectionMapped: true,
      idempotencyConflictMapped: true,
      recordIdConflictMapped: true,
      auditAppendOnlyMapped: true,
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

export function evaluateGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(
  scaffold: GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1,
): GslrPersistentStaticRepositoryExecutableAdapterScaffoldResultV1 {
  assertSchemaVersion(scaffold);
  const blockers = [
    ...designReviewBlockers(scaffold),
    ...scaffoldBlockers(scaffold),
    ...persistenceBoundaryBlockers(scaffold),
    ...contractHarnessBlockers(scaffold),
    ...authorityBlockers(scaffold),
  ];

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_SCAFFOLD_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-for-scaffold-code-review' : 'blocked',
    blockers,
    scaffoldArtifacts: [
      'PostgreSQL adapter class name and port method scaffold',
      'planned transaction boundary without database binding',
      'contract harness mapping without database execution',
      'persistence boundary with reads and writes blocked',
      'no-runtime authority guard list',
    ],
    recommendedNextBead:
      blockers.length === 0
        ? 'Open a scaffold code review bead that verifies the adapter shell still has no database client, connection config, SQL files, secrets, applied migrations, production tables, or production writes.'
        : 'Resolve executable adapter scaffold blockers before code review.',
    boundaryWarnings: [
      'This scaffold names an executable adapter shape only.',
      'It does not bind a database client, create connection configuration, generate SQL files, reference secrets, apply migrations, create production tables, enable reads, or enable writes.',
      'It does not poll prompt-language manifests, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
    ],
  });
}

function designReviewBlockers(
  scaffold: GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1,
): string[] {
  if (scaffold.designReview.status === 'ready-to-open-executable-adapter-scaffold-bead') {
    return [];
  }
  return [
    'designReview status must be ready-to-open-executable-adapter-scaffold-bead',
    ...scaffold.designReview.blockers.map((blocker) => `design review blocker: ${blocker}`),
  ];
}

function scaffoldBlockers(
  scaffold: GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1,
): string[] {
  const blockers: string[] = [];
  if (scaffold.scaffold.adapterName !== 'GslrPersistentStaticRepositoryPostgresAdapter') {
    blockers.push('adapterName must be GslrPersistentStaticRepositoryPostgresAdapter');
  }
  if (scaffold.scaffold.implementationMode !== 'scaffold-only') {
    blockers.push('implementationMode must be scaffold-only');
  }
  for (const method of requiredPortMethods) {
    if (!scaffold.scaffold.portMethods.includes(method)) {
      blockers.push(`port method ${method} must be present`);
    }
  }
  if (scaffold.scaffold.transactionBoundary !== 'planned-not-bound') {
    blockers.push('transactionBoundary must be planned-not-bound');
  }
  if (scaffold.scaffold.databaseClientBinding !== 'absent') {
    blockers.push('databaseClientBinding must be absent');
  }
  if (scaffold.scaffold.connectionConfig !== 'absent') {
    blockers.push('connectionConfig must be absent');
  }
  if (scaffold.scaffold.generatedSqlFiles !== 'absent') {
    blockers.push('generatedSqlFiles must be absent');
  }
  if (scaffold.scaffold.secretReferences !== 'absent') {
    blockers.push('secretReferences must be absent');
  }
  return blockers;
}

function persistenceBoundaryBlockers(
  scaffold: GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1,
): string[] {
  const blockers: string[] = [];
  if (scaffold.persistenceBoundary.migrationStatus !== 'draft-not-applied') {
    blockers.push('migrationStatus must be draft-not-applied');
  }
  if (scaffold.persistenceBoundary.productionTablesCreated) {
    blockers.push('productionTablesCreated must be false');
  }
  if (scaffold.persistenceBoundary.productionWritesEnabled) {
    blockers.push('productionWritesEnabled must be false');
  }
  if (scaffold.persistenceBoundary.writeExecution !== 'blocked') {
    blockers.push('writeExecution must be blocked');
  }
  if (scaffold.persistenceBoundary.readExecution !== 'blocked') {
    blockers.push('readExecution must be blocked');
  }
  return blockers;
}

function contractHarnessBlockers(
  scaffold: GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1,
): string[] {
  const blockers: string[] = [];
  if (scaffold.contractHarness.bindingMode !== 'planned-not-executed') {
    blockers.push('contractHarness bindingMode must be planned-not-executed');
  }
  for (const [key, value] of Object.entries(scaffold.contractHarness)) {
    if (key !== 'bindingMode' && value !== true) {
      blockers.push(`contractHarness ${key} must be true`);
    }
  }
  return blockers;
}

function authorityBlockers(
  scaffold: GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1,
): string[] {
  const blockers: string[] = [];
  if (scaffold.authority.livePromptLanguagePolling !== 'blocked') {
    blockers.push('livePromptLanguagePolling must be blocked');
  }
  if (scaffold.authority.queues !== 'absent') {
    blockers.push('queues must be absent');
  }
  if (scaffold.authority.sseStreams !== 'absent') {
    blockers.push('sseStreams must be absent');
  }
  if (scaffold.authority.runtimeCards !== 'absent') {
    blockers.push('runtimeCards must be absent');
  }
  if (scaffold.authority.productionActions !== 'blocked') {
    blockers.push('productionActions must be blocked');
  }
  if (scaffold.authority.mcConnectorAccess !== 'blocked') {
    blockers.push('mcConnectorAccess must be blocked');
  }
  return blockers;
}

const requiredPortMethods: readonly GslrPersistentStaticRepositoryExecutableAdapterScaffoldMethodV1[] =
  [
    'appendStaticImportedRecord',
    'getStaticImportedRecord',
    'listStaticImportedRecords',
    'transitionStaticImportedRecordReviewState',
    'auditTrailForStaticImportedRecord',
  ];

function assertSchemaVersion(scaffold: GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1) {
  if (
    scaffold.schemaVersion !==
    GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_SCAFFOLD_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_SCAFFOLD_V1_SCHEMA_VERSION}`,
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
