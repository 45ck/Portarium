import type {
  GslrPersistentStaticRepositoryScaffoldCodeReviewResultV1,
  GslrPersistentStaticRepositoryScaffoldCodeReviewStatusV1,
} from './gslr-persistent-static-repository-scaffold-code-review-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-unbound-adapter-shell.v1' as const;

export type GslrPersistentStaticRepositoryUnboundAdapterShellStatusV1 =
  | 'ready-for-unbound-adapter-shell-review'
  | 'blocked';

export type GslrPersistentStaticRepositoryUnboundAdapterShellMethodV1 =
  | 'appendStaticImportedRecord'
  | 'getStaticImportedRecord'
  | 'listStaticImportedRecords'
  | 'transitionStaticImportedRecordReviewState'
  | 'auditTrailForStaticImportedRecord';

export type GslrPersistentStaticRepositoryUnboundAdapterShellV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_V1_SCHEMA_VERSION;
  scaffoldCodeReview: Readonly<{
    status: GslrPersistentStaticRepositoryScaffoldCodeReviewStatusV1;
    blockers: readonly string[];
  }>;
  shell: Readonly<{
    adapterName: 'GslrPersistentStaticRepositoryPostgresAdapter';
    implementationMode: 'unbound-shell-only' | 'database-bound';
    exportedPortMethods: readonly GslrPersistentStaticRepositoryUnboundAdapterShellMethodV1[];
    constructorBinding: 'none' | 'database-client';
    transactionBoundary: 'declared-not-bound' | 'bound';
    methodBodies: 'throw-not-implemented' | 'execute-database';
    errorMapping: 'declared-only' | 'executable';
  }>;
  databaseArtifacts: Readonly<{
    databaseClientBinding: 'absent' | 'present';
    connectionConfig: 'absent' | 'present';
    generatedSqlFiles: 'absent' | 'present';
    secretReferences: 'absent' | 'present';
    appliedMigrations: 'absent' | 'present';
    productionTables: 'absent' | 'present';
    readExecution: 'blocked' | 'enabled';
    writeExecution: 'blocked' | 'enabled';
  }>;
  reviewSurface: Readonly<{
    portShapeVisible: boolean;
    constructorBoundaryVisible: boolean;
    transactionBoundaryVisible: boolean;
    databaseBindingTodoVisible: boolean;
    contractHarnessTodoVisible: boolean;
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

export type GslrPersistentStaticRepositoryUnboundAdapterShellResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryUnboundAdapterShellStatusV1;
  blockers: readonly string[];
  shellArtifacts: readonly string[];
  recommendedNextBead: string;
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryUnboundAdapterShellV1(
  scaffoldCodeReview: GslrPersistentStaticRepositoryScaffoldCodeReviewResultV1,
): GslrPersistentStaticRepositoryUnboundAdapterShellV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_V1_SCHEMA_VERSION,
    scaffoldCodeReview: {
      status: scaffoldCodeReview.status,
      blockers: scaffoldCodeReview.blockers,
    },
    shell: {
      adapterName: 'GslrPersistentStaticRepositoryPostgresAdapter',
      implementationMode: 'unbound-shell-only',
      exportedPortMethods: [
        'appendStaticImportedRecord',
        'getStaticImportedRecord',
        'listStaticImportedRecords',
        'transitionStaticImportedRecordReviewState',
        'auditTrailForStaticImportedRecord',
      ],
      constructorBinding: 'none',
      transactionBoundary: 'declared-not-bound',
      methodBodies: 'throw-not-implemented',
      errorMapping: 'declared-only',
    },
    databaseArtifacts: {
      databaseClientBinding: 'absent',
      connectionConfig: 'absent',
      generatedSqlFiles: 'absent',
      secretReferences: 'absent',
      appliedMigrations: 'absent',
      productionTables: 'absent',
      readExecution: 'blocked',
      writeExecution: 'blocked',
    },
    reviewSurface: {
      portShapeVisible: true,
      constructorBoundaryVisible: true,
      transactionBoundaryVisible: true,
      databaseBindingTodoVisible: true,
      contractHarnessTodoVisible: true,
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

export function evaluateGslrPersistentStaticRepositoryUnboundAdapterShellV1(
  shell: GslrPersistentStaticRepositoryUnboundAdapterShellV1,
): GslrPersistentStaticRepositoryUnboundAdapterShellResultV1 {
  assertSchemaVersion(shell);
  const blockers = [
    ...scaffoldCodeReviewBlockers(shell),
    ...shellBlockers(shell),
    ...databaseArtifactBlockers(shell),
    ...reviewSurfaceBlockers(shell),
    ...authorityBlockers(shell),
  ];

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-for-unbound-adapter-shell-review' : 'blocked',
    blockers,
    shellArtifacts: [
      'PostgreSQL adapter shell name',
      'persistent static repository port method exports',
      'constructor with no database client binding',
      'declared transaction boundary without execution',
      'not-implemented method bodies for review',
      'declared-only error mapping surface',
    ],
    recommendedNextBead:
      blockers.length === 0
        ? 'Open an unbound adapter shell review bead before adding database client binding, connection config, generated SQL, secrets, migrations, tables, reads, or writes.'
        : 'Resolve unbound adapter shell blockers before shell review.',
    boundaryWarnings: [
      'This adapter shell is intentionally unbound and non-operational.',
      'It does not bind a database client, create connection configuration, generate SQL files, reference secrets, apply migrations, create production tables, enable reads, or enable writes.',
      'It does not poll prompt-language manifests, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
    ],
  });
}

function scaffoldCodeReviewBlockers(
  shell: GslrPersistentStaticRepositoryUnboundAdapterShellV1,
): string[] {
  if (shell.scaffoldCodeReview.status === 'ready-to-open-unbound-adapter-shell-bead') return [];
  return [
    'scaffoldCodeReview status must be ready-to-open-unbound-adapter-shell-bead',
    ...shell.scaffoldCodeReview.blockers.map(
      (blocker) => `scaffold code review blocker: ${blocker}`,
    ),
  ];
}

function shellBlockers(shell: GslrPersistentStaticRepositoryUnboundAdapterShellV1): string[] {
  const blockers: string[] = [];
  if (shell.shell.adapterName !== 'GslrPersistentStaticRepositoryPostgresAdapter') {
    blockers.push('adapterName must be GslrPersistentStaticRepositoryPostgresAdapter');
  }
  if (shell.shell.implementationMode !== 'unbound-shell-only') {
    blockers.push('implementationMode must be unbound-shell-only');
  }
  for (const method of requiredPortMethods) {
    if (!shell.shell.exportedPortMethods.includes(method)) {
      blockers.push(`exported port method ${method} must be present`);
    }
  }
  if (shell.shell.constructorBinding !== 'none') {
    blockers.push('constructorBinding must be none');
  }
  if (shell.shell.transactionBoundary !== 'declared-not-bound') {
    blockers.push('transactionBoundary must be declared-not-bound');
  }
  if (shell.shell.methodBodies !== 'throw-not-implemented') {
    blockers.push('methodBodies must be throw-not-implemented');
  }
  if (shell.shell.errorMapping !== 'declared-only') {
    blockers.push('errorMapping must be declared-only');
  }
  return blockers;
}

function databaseArtifactBlockers(
  shell: GslrPersistentStaticRepositoryUnboundAdapterShellV1,
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
    if (shell.databaseArtifacts[key] !== 'absent') {
      blockers.push(`${key} must be absent`);
    }
  }
  if (shell.databaseArtifacts.readExecution !== 'blocked') {
    blockers.push('readExecution must be blocked');
  }
  if (shell.databaseArtifacts.writeExecution !== 'blocked') {
    blockers.push('writeExecution must be blocked');
  }
  return blockers;
}

function reviewSurfaceBlockers(
  shell: GslrPersistentStaticRepositoryUnboundAdapterShellV1,
): string[] {
  return (Object.entries(shell.reviewSurface) as [keyof typeof shell.reviewSurface, boolean][])
    .filter(([, value]) => !value)
    .map(([key]) => `${key} must be true`);
}

function authorityBlockers(shell: GslrPersistentStaticRepositoryUnboundAdapterShellV1): string[] {
  const blockers: string[] = [];
  if (shell.authority.livePromptLanguagePolling !== 'blocked') {
    blockers.push('livePromptLanguagePolling must be blocked');
  }
  if (shell.authority.queues !== 'absent') blockers.push('queues must be absent');
  if (shell.authority.sseStreams !== 'absent') blockers.push('sseStreams must be absent');
  if (shell.authority.runtimeCards !== 'absent') blockers.push('runtimeCards must be absent');
  if (shell.authority.productionActions !== 'blocked') {
    blockers.push('productionActions must be blocked');
  }
  if (shell.authority.mcConnectorAccess !== 'blocked') {
    blockers.push('mcConnectorAccess must be blocked');
  }
  return blockers;
}

const requiredPortMethods: readonly GslrPersistentStaticRepositoryUnboundAdapterShellMethodV1[] = [
  'appendStaticImportedRecord',
  'getStaticImportedRecord',
  'listStaticImportedRecords',
  'transitionStaticImportedRecordReviewState',
  'auditTrailForStaticImportedRecord',
];

function assertSchemaVersion(shell: GslrPersistentStaticRepositoryUnboundAdapterShellV1) {
  if (
    shell.schemaVersion !==
    GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_V1_SCHEMA_VERSION}`,
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
