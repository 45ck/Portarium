import type {
  GslrPersistentStaticRepositoryImplementationResultV1,
  GslrPersistentStaticRepositoryImplementationStatusV1,
} from './gslr-persistent-static-repository-implementation-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_ADAPTER_CONTRACT_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-adapter-contract.v1' as const;

export type GslrPersistentStaticRepositoryAdapterContractStatusV1 =
  | 'ready-for-adapter-code-review'
  | 'blocked';

export type GslrPersistentStaticRepositoryAdapterContractV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_ADAPTER_CONTRACT_V1_SCHEMA_VERSION;
  implementationContract: Readonly<{
    status: GslrPersistentStaticRepositoryImplementationStatusV1;
    blockers: readonly string[];
  }>;
  adapterUnderTest: Readonly<{
    kind: 'contract-harness-only' | 'postgres-production-adapter' | 'runtime-importer-adapter';
    migrationsApplied: boolean;
    productionTablesCreated: boolean;
    productionWritesEnabled: boolean;
  }>;
  contractCases: Readonly<{
    appendAcceptedRecord: 'covered' | 'missing';
    idempotentReplay: 'covered' | 'missing';
    idempotencyConflict: 'covered' | 'missing';
    recordIdConflict: 'covered' | 'missing';
    canonicalFingerprint: 'covered' | 'missing';
    rawPayloadRejected: 'covered' | 'missing';
    constrainedReviewTransition: 'covered' | 'missing';
    auditTrailAppendOnly: 'covered' | 'missing';
    missingRecordRead: 'covered' | 'missing';
    forbiddenRuntimeOperationsAbsent: 'covered' | 'missing';
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

export type GslrPersistentStaticRepositoryAdapterContractResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_ADAPTER_CONTRACT_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryAdapterContractStatusV1;
  blockers: readonly string[];
  requiredAdapterAssertions: readonly string[];
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryAdapterContractV1(
  implementationContract: GslrPersistentStaticRepositoryImplementationResultV1,
): GslrPersistentStaticRepositoryAdapterContractV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_ADAPTER_CONTRACT_V1_SCHEMA_VERSION,
    implementationContract: {
      status: implementationContract.status,
      blockers: implementationContract.blockers,
    },
    adapterUnderTest: {
      kind: 'contract-harness-only',
      migrationsApplied: false,
      productionTablesCreated: false,
      productionWritesEnabled: false,
    },
    contractCases: {
      appendAcceptedRecord: 'covered',
      idempotentReplay: 'covered',
      idempotencyConflict: 'covered',
      recordIdConflict: 'covered',
      canonicalFingerprint: 'covered',
      rawPayloadRejected: 'covered',
      constrainedReviewTransition: 'covered',
      auditTrailAppendOnly: 'covered',
      missingRecordRead: 'covered',
      forbiddenRuntimeOperationsAbsent: 'covered',
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

export function evaluateGslrPersistentStaticRepositoryAdapterContractV1(
  contract: GslrPersistentStaticRepositoryAdapterContractV1,
): GslrPersistentStaticRepositoryAdapterContractResultV1 {
  assertSchemaVersion(contract);
  const blockers = [
    ...implementationContractBlockers(contract),
    ...adapterUnderTestBlockers(contract),
    ...contractCaseBlockers(contract),
    ...authorityBlockers(contract),
  ];

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_ADAPTER_CONTRACT_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-for-adapter-code-review' : 'blocked',
    blockers,
    requiredAdapterAssertions: [
      'append accepted static imported record without runtime authority',
      'replay identical idempotency key without duplicate write',
      'reject idempotency key reused with different record fingerprint',
      'reject record id reused under a different idempotency key',
      'persist canonical JSON SHA-256 record fingerprint',
      'reject raw payload storage',
      'enforce constrained review transitions with actor and reason',
      'record append-only audit trail events',
      'return null for missing record reads',
      'expose no update, delete, queue, stream, runtime-card, action, or MC connector operations',
    ],
    boundaryWarnings: [
      'This adapter contract is a contract-harness gate only.',
      'It does not apply migrations, create production tables, write production state, poll prompt-language manifests, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
      'A future database adapter must pass these cases before production persistence can be considered.',
    ],
  });
}

function implementationContractBlockers(
  contract: GslrPersistentStaticRepositoryAdapterContractV1,
): string[] {
  if (contract.implementationContract.status === 'ready-for-code-review') return [];
  return [
    'implementationContract status must be ready-for-code-review',
    ...contract.implementationContract.blockers.map(
      (blocker) => `implementation contract blocker: ${blocker}`,
    ),
  ];
}

function adapterUnderTestBlockers(
  contract: GslrPersistentStaticRepositoryAdapterContractV1,
): string[] {
  const blockers: string[] = [];
  if (contract.adapterUnderTest.kind !== 'contract-harness-only') {
    blockers.push('adapterUnderTest kind must be contract-harness-only');
  }
  if (contract.adapterUnderTest.migrationsApplied) {
    blockers.push('adapterUnderTest migrationsApplied must be false');
  }
  if (contract.adapterUnderTest.productionTablesCreated) {
    blockers.push('adapterUnderTest productionTablesCreated must be false');
  }
  if (contract.adapterUnderTest.productionWritesEnabled) {
    blockers.push('adapterUnderTest productionWritesEnabled must be false');
  }
  return blockers;
}

function contractCaseBlockers(contract: GslrPersistentStaticRepositoryAdapterContractV1): string[] {
  return (Object.entries(contract.contractCases) as [keyof typeof contract.contractCases, string][])
    .filter(([, status]) => status !== 'covered')
    .map(([key]) => `contract case ${key} must be covered`);
}

function authorityBlockers(contract: GslrPersistentStaticRepositoryAdapterContractV1): string[] {
  const blockers: string[] = [];
  if (contract.authority.livePromptLanguagePolling !== 'blocked') {
    blockers.push('livePromptLanguagePolling must be blocked');
  }
  if (contract.authority.queues !== 'absent') {
    blockers.push('queues must be absent');
  }
  if (contract.authority.sseStreams !== 'absent') {
    blockers.push('sseStreams must be absent');
  }
  if (contract.authority.runtimeCards !== 'absent') {
    blockers.push('runtimeCards must be absent');
  }
  if (contract.authority.productionActions !== 'blocked') {
    blockers.push('productionActions must be blocked');
  }
  if (contract.authority.mcConnectorAccess !== 'blocked') {
    blockers.push('mcConnectorAccess must be blocked');
  }
  return blockers;
}

function assertSchemaVersion(contract: GslrPersistentStaticRepositoryAdapterContractV1) {
  if (
    contract.schemaVersion !== GSLR_PERSISTENT_STATIC_REPOSITORY_ADAPTER_CONTRACT_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_ADAPTER_CONTRACT_V1_SCHEMA_VERSION}`,
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
