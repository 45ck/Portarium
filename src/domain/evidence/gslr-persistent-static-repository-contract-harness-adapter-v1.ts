import type {
  GslrPersistentStaticRepositoryAdapterContractResultV1,
  GslrPersistentStaticRepositoryAdapterContractStatusV1,
} from './gslr-persistent-static-repository-adapter-contract-v1.js';
import {
  createGslrStaticImportedRecordRepositoryDesignV1,
  GslrStaticImportedRecordRepositoryError,
  type GslrStaticImportedRecordRepositoryAppendInputV1,
  type GslrStaticImportedRecordRepositoryAppendResultV1,
  type GslrStaticImportedRecordRepositoryAuditEventV1,
  type GslrStaticImportedRecordRepositoryEntryV1,
  type GslrStaticImportedRecordRepositoryTransitionInputV1,
} from './gslr-static-imported-record-repository-v1.js';
import type { GslrStaticImportedRecordV1 } from './gslr-static-imported-record-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_CONTRACT_HARNESS_ADAPTER_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-contract-harness-adapter.v1' as const;

export type GslrPersistentStaticRepositoryContractHarnessAdapterV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_CONTRACT_HARNESS_ADAPTER_V1_SCHEMA_VERSION;
  metadata: Readonly<{
    adapterKind: 'contract-harness-only';
    contractStatus: GslrPersistentStaticRepositoryAdapterContractStatusV1;
    migrationsApplied: false;
    productionTablesCreated: false;
    productionWritesEnabled: false;
    livePromptLanguagePolling: 'blocked';
    queues: 'absent';
    sseStreams: 'absent';
    runtimeCards: 'absent';
    productionActions: 'blocked';
    mcConnectorAccess: 'blocked';
  }>;
  appendStaticImportedRecord(
    input: GslrStaticImportedRecordRepositoryAppendInputV1,
  ): GslrStaticImportedRecordRepositoryAppendResultV1;
  getStaticImportedRecord(recordId: string): GslrStaticImportedRecordRepositoryEntryV1 | null;
  listStaticImportedRecords(): readonly GslrStaticImportedRecordRepositoryEntryV1[];
  transitionStaticImportedRecordReviewState(
    input: GslrStaticImportedRecordRepositoryTransitionInputV1,
  ): GslrStaticImportedRecordRepositoryEntryV1;
  auditTrailForStaticImportedRecord(
    recordId: string,
  ): readonly GslrStaticImportedRecordRepositoryAuditEventV1[];
  boundaryWarnings: readonly string[];
}>;

export function createGslrPersistentStaticRepositoryContractHarnessAdapterV1(
  contract: GslrPersistentStaticRepositoryAdapterContractResultV1,
): GslrPersistentStaticRepositoryContractHarnessAdapterV1 {
  if (contract.status !== 'ready-for-adapter-code-review') {
    throw new GslrStaticImportedRecordRepositoryError(
      'invalid_repository_input',
      'adapter contract must be ready-for-adapter-code-review',
    );
  }

  const repository = createGslrStaticImportedRecordRepositoryDesignV1();

  return Object.freeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_CONTRACT_HARNESS_ADAPTER_V1_SCHEMA_VERSION,
    metadata: Object.freeze({
      adapterKind: 'contract-harness-only',
      contractStatus: contract.status,
      migrationsApplied: false,
      productionTablesCreated: false,
      productionWritesEnabled: false,
      livePromptLanguagePolling: 'blocked',
      queues: 'absent',
      sseStreams: 'absent',
      runtimeCards: 'absent',
      productionActions: 'blocked',
      mcConnectorAccess: 'blocked',
    }),
    appendStaticImportedRecord(input) {
      assertNoRawPayload(input.record);
      return repository.append(input);
    },
    getStaticImportedRecord(recordId) {
      return repository.get(recordId);
    },
    listStaticImportedRecords() {
      return repository.list();
    },
    transitionStaticImportedRecordReviewState(input) {
      return repository.transitionReviewState(input);
    },
    auditTrailForStaticImportedRecord(recordId) {
      return repository.auditTrail(recordId);
    },
    boundaryWarnings: Object.freeze([
      'Persistent static repository contract harness is docs/test-only.',
      'Contract harness does not apply migrations, create production tables, or enable production writes.',
      'Contract harness does not poll prompt-language, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
    ]),
  });
}

function assertNoRawPayload(record: GslrStaticImportedRecordV1) {
  const maybeRecord = record as unknown as Record<string, unknown>;
  if (
    'rawPayload' in maybeRecord ||
    'raw_payload' in maybeRecord ||
    'payload' in maybeRecord ||
    'rawBundlePayload' in maybeRecord
  ) {
    throw new GslrStaticImportedRecordRepositoryError(
      'runtime_authority_forbidden',
      'persistent static repository contract harness rejects raw payload storage',
    );
  }
}
