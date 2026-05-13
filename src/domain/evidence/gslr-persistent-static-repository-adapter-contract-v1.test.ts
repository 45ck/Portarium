import { describe, expect, it } from 'vitest';
import {
  evaluateGslrPersistentStaticImportedRecordStorageDesignV1,
  recommendedGslrPersistentStaticImportedRecordStorageDesignV1,
} from './gslr-persistent-static-imported-record-storage-design-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryAdapterContractV1,
  recommendedGslrPersistentStaticRepositoryAdapterContractV1,
  type GslrPersistentStaticRepositoryAdapterContractV1,
} from './gslr-persistent-static-repository-adapter-contract-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryImplementationReadinessV1,
  recommendedGslrPersistentStaticRepositoryImplementationReadinessV1,
} from './gslr-persistent-static-repository-implementation-readiness-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryImplementationV1,
  recommendedGslrPersistentStaticRepositoryImplementationV1,
} from './gslr-persistent-static-repository-implementation-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryReviewPacketV1,
  recommendedGslrPersistentStaticRepositoryReviewPacketV1,
} from './gslr-persistent-static-repository-review-packet-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1,
  recommendedGslrPersistentStaticRepositoryStopReviewCheckpointV1,
} from './gslr-persistent-static-repository-stop-review-checkpoint-v1.js';
import {
  evaluateGslrStaticImportVerificationDesignV1,
  recommendedGslrStaticImportVerificationDesignV1,
} from './gslr-static-import-verification-design-v1.js';

describe('GslrPersistentStaticRepositoryAdapterContractV1', () => {
  it('accepts the recommended adapter contract harness without production writes', () => {
    const contract = recommendedAdapterContract();
    const result = evaluateGslrPersistentStaticRepositoryAdapterContractV1(contract);

    expect(result.status).toBe('ready-for-adapter-code-review');
    expect(result.blockers).toEqual([]);
    expect(result.requiredAdapterAssertions).toContain(
      'persist canonical JSON SHA-256 record fingerprint',
    );
    expect(result.requiredAdapterAssertions).toContain('reject raw payload storage');
    expect(result.boundaryWarnings.join(' ')).toContain('does not apply migrations');
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(result.requiredAdapterAssertions)).toBe(true);
  });

  it('blocks adapter tests when the implementation contract is blocked', () => {
    const result = evaluateGslrPersistentStaticRepositoryAdapterContractV1(
      contractWith({
        implementationContract: {
          status: 'blocked',
          blockers: ['draftMigration status must be draft-not-applied'],
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'implementationContract status must be ready-for-code-review',
      'implementation contract blocker: draftMigration status must be draft-not-applied',
    ]);
  });

  it('blocks production adapters, applied migrations, tables, and writes', () => {
    const result = evaluateGslrPersistentStaticRepositoryAdapterContractV1(
      contractWith({
        adapterUnderTest: {
          kind: 'postgres-production-adapter',
          migrationsApplied: true,
          productionTablesCreated: true,
          productionWritesEnabled: true,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'adapterUnderTest kind must be contract-harness-only',
      'adapterUnderTest migrationsApplied must be false',
      'adapterUnderTest productionTablesCreated must be false',
      'adapterUnderTest productionWritesEnabled must be false',
    ]);
  });

  it('blocks missing adapter contract coverage', () => {
    const result = evaluateGslrPersistentStaticRepositoryAdapterContractV1(
      contractWith({
        contractCases: {
          canonicalFingerprint: 'missing',
          rawPayloadRejected: 'missing',
          forbiddenRuntimeOperationsAbsent: 'missing',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'contract case canonicalFingerprint must be covered',
      'contract case rawPayloadRejected must be covered',
      'contract case forbiddenRuntimeOperationsAbsent must be covered',
    ]);
  });

  it('blocks runtime authority surfaces', () => {
    const result = evaluateGslrPersistentStaticRepositoryAdapterContractV1(
      contractWith({
        authority: {
          livePromptLanguagePolling: 'allowed',
          queues: 'present',
          sseStreams: 'present',
          runtimeCards: 'present',
          productionActions: 'allowed',
          mcConnectorAccess: 'allowed',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'livePromptLanguagePolling must be blocked',
      'queues must be absent',
      'sseStreams must be absent',
      'runtimeCards must be absent',
      'productionActions must be blocked',
      'mcConnectorAccess must be blocked',
    ]);
  });
});

function recommendedAdapterContract(): GslrPersistentStaticRepositoryAdapterContractV1 {
  const verificationGate = evaluateGslrStaticImportVerificationDesignV1(
    recommendedGslrStaticImportVerificationDesignV1(),
  );
  const storageDesign =
    recommendedGslrPersistentStaticImportedRecordStorageDesignV1(verificationGate);
  const storageResult = evaluateGslrPersistentStaticImportedRecordStorageDesignV1(storageDesign);
  expect(storageResult.status).toBe('ready-for-persistent-static-storage-design');
  const readiness = evaluateGslrPersistentStaticRepositoryImplementationReadinessV1(
    recommendedGslrPersistentStaticRepositoryImplementationReadinessV1(storageDesign),
  );
  const checkpoint = evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1(
    recommendedGslrPersistentStaticRepositoryStopReviewCheckpointV1(readiness),
  );
  const reviewPacket = recommendedGslrPersistentStaticRepositoryReviewPacketV1(checkpoint);
  const approvedReviewPacket = evaluateGslrPersistentStaticRepositoryReviewPacketV1({
    ...reviewPacket,
    reviewDecision: {
      ...reviewPacket.reviewDecision,
      operatorDecision: 'approve-static-persistence',
      productDecision: 'approve-static-persistence',
      staticValueConfirmed: true,
    },
  });
  const implementation = evaluateGslrPersistentStaticRepositoryImplementationV1(
    recommendedGslrPersistentStaticRepositoryImplementationV1(approvedReviewPacket),
  );
  expect(implementation.status).toBe('ready-for-code-review');
  return recommendedGslrPersistentStaticRepositoryAdapterContractV1(implementation);
}

function contractWith(
  overrides: Partial<{
    implementationContract: Partial<
      GslrPersistentStaticRepositoryAdapterContractV1['implementationContract']
    >;
    adapterUnderTest: Partial<GslrPersistentStaticRepositoryAdapterContractV1['adapterUnderTest']>;
    contractCases: Partial<GslrPersistentStaticRepositoryAdapterContractV1['contractCases']>;
    authority: Partial<GslrPersistentStaticRepositoryAdapterContractV1['authority']>;
  }> = {},
): GslrPersistentStaticRepositoryAdapterContractV1 {
  const contract = recommendedAdapterContract();
  return {
    ...contract,
    implementationContract: {
      ...contract.implementationContract,
      ...overrides.implementationContract,
    },
    adapterUnderTest: {
      ...contract.adapterUnderTest,
      ...overrides.adapterUnderTest,
    },
    contractCases: {
      ...contract.contractCases,
      ...overrides.contractCases,
    },
    authority: {
      ...contract.authority,
      ...overrides.authority,
    },
  };
}
