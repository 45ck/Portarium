import { describe, expect, it } from 'vitest';
import {
  evaluateGslrPersistentStaticImportedRecordStorageDesignV1,
  recommendedGslrPersistentStaticImportedRecordStorageDesignV1,
} from './gslr-persistent-static-imported-record-storage-design-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryImplementationReadinessV1,
  recommendedGslrPersistentStaticRepositoryImplementationReadinessV1,
} from './gslr-persistent-static-repository-implementation-readiness-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryImplementationV1,
  recommendedGslrPersistentStaticRepositoryImplementationV1,
  type GslrPersistentStaticRepositoryImplementationV1,
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

describe('GslrPersistentStaticRepositoryImplementationV1', () => {
  it('accepts the port and draft migration contract after review packet approval', () => {
    const implementation = recommendedImplementation();
    const result = evaluateGslrPersistentStaticRepositoryImplementationV1(implementation);

    expect(result.status).toBe('ready-for-code-review');
    expect(result.blockers).toEqual([]);
    expect(result.implementedArtifacts).toContain(
      'persistent static repository port specification',
    );
    expect(result.implementedArtifacts).toContain('append-only static imported record table draft');
    expect(result.nextReviewChecks).toContain(
      'review the draft migration before applying it anywhere',
    );
    expect(result.boundaryWarnings.join(' ')).toContain('does not apply migrations');
    expect(Object.isFrozen(implementation)).toBe(true);
    expect(Object.isFrozen(result.implementedArtifacts)).toBe(true);
  });

  it('blocks implementation when the review packet is not approved', () => {
    const result = evaluateGslrPersistentStaticRepositoryImplementationV1(
      implementationWith({
        reviewPacket: {
          status: 'ready-for-static-review',
          blockers: [],
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'reviewPacket status must be ready-to-open-implementation-bead',
    ]);
  });

  it('blocks missing port operations and unsafe port semantics', () => {
    const result = evaluateGslrPersistentStaticRepositoryImplementationV1(
      implementationWith({
        repositoryPort: {
          operations: ['appendStaticImportedRecord'],
          forbiddenOperations: ['deleteStaticImportedRecord'],
          appendSemantics: 'append-only',
          idempotency: 'required-unique-key',
          recordFingerprint: 'canonical-json-sha256-required',
          rawPayloadStorage: 'forbidden',
          reviewTransitions: 'constrained-with-actor-and-reason',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'repositoryPort operation getStaticImportedRecord must be present',
      'repositoryPort operation listStaticImportedRecords must be present',
      'repositoryPort operation transitionStaticImportedRecordReviewState must be present',
      'repositoryPort operation auditTrailForStaticImportedRecord must be present',
      'repositoryPort forbiddenOperations must list all forbidden runtime paths',
    ]);
  });

  it('blocks applied migrations, production tables, production writes, and missing constraints', () => {
    const result = evaluateGslrPersistentStaticRepositoryImplementationV1(
      implementationWith({
        draftMigration: {
          status: 'applied',
          productionTablesCreated: true,
          productionWritesEnabled: true,
          tables: ['gslr_static_imported_records'],
          constraints: ['unique(idempotency_key)'],
          auditEvents: 'mutable-table',
          rollbackPlan: 'destructive-production-rollback',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'draftMigration status must be draft-not-applied',
      'draftMigration productionTablesCreated must be false',
      'draftMigration productionWritesEnabled must be false',
      'draftMigration table gslr_static_imported_record_audit_events must be listed',
      'draftMigration constraint unique(record_id) must be listed',
      'draftMigration constraint check(record_fingerprint_sha256 = sha256(canonical_json(record))) must be listed',
      'draftMigration constraint check(raw_payload is null) must be listed',
      'draftMigration constraint check(review_state in constrained_static_review_states) must be listed',
      'draftMigration auditEvents must be append-only-table',
      'draftMigration rollbackPlan must be documented-drop-draft-only',
    ]);
  });

  it('blocks runtime authority surfaces', () => {
    const result = evaluateGslrPersistentStaticRepositoryImplementationV1(
      implementationWith({
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

function recommendedImplementation(): GslrPersistentStaticRepositoryImplementationV1 {
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
  expect(approvedReviewPacket.status).toBe('ready-to-open-implementation-bead');
  return recommendedGslrPersistentStaticRepositoryImplementationV1(approvedReviewPacket);
}

function implementationWith(
  overrides: Partial<{
    reviewPacket: Partial<GslrPersistentStaticRepositoryImplementationV1['reviewPacket']>;
    repositoryPort: Partial<GslrPersistentStaticRepositoryImplementationV1['repositoryPort']>;
    draftMigration: Partial<GslrPersistentStaticRepositoryImplementationV1['draftMigration']>;
    authority: Partial<GslrPersistentStaticRepositoryImplementationV1['authority']>;
  }> = {},
): GslrPersistentStaticRepositoryImplementationV1 {
  const implementation = recommendedImplementation();
  return {
    ...implementation,
    reviewPacket: {
      ...implementation.reviewPacket,
      ...overrides.reviewPacket,
    },
    repositoryPort: {
      ...implementation.repositoryPort,
      ...overrides.repositoryPort,
    },
    draftMigration: {
      ...implementation.draftMigration,
      ...overrides.draftMigration,
    },
    authority: {
      ...implementation.authority,
      ...overrides.authority,
    },
  };
}
