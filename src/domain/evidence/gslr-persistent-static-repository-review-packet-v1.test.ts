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
  evaluateGslrPersistentStaticRepositoryReviewPacketV1,
  recommendedGslrPersistentStaticRepositoryReviewPacketV1,
  type GslrPersistentStaticRepositoryReviewPacketV1,
} from './gslr-persistent-static-repository-review-packet-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1,
  recommendedGslrPersistentStaticRepositoryStopReviewCheckpointV1,
} from './gslr-persistent-static-repository-stop-review-checkpoint-v1.js';
import {
  evaluateGslrStaticImportVerificationDesignV1,
  recommendedGslrStaticImportVerificationDesignV1,
} from './gslr-static-import-verification-design-v1.js';

describe('GslrPersistentStaticRepositoryReviewPacketV1', () => {
  it('prepares a static-only review packet from the stop-review checkpoint', () => {
    const packet = recommendedPacket();
    const result = evaluateGslrPersistentStaticRepositoryReviewPacketV1(packet);

    expect(result.status).toBe('ready-for-static-review');
    expect(result.blockers).toEqual([]);
    expect(result.reviewNeeds).toEqual([
      'operator decision is requested',
      'product decision is requested',
      'static persistence value must be confirmed',
    ]);
    expect(result.recommendedNextBead).toContain('Complete operator and product review');
    expect(result.boundaryWarnings.join(' ')).toContain('does not add database migrations');
    expect(Object.isFrozen(packet)).toBe(true);
    expect(Object.isFrozen(result.reviewNeeds)).toBe(true);
  });

  it('opens implementation after operator and product approve static persistence', () => {
    const result = evaluateGslrPersistentStaticRepositoryReviewPacketV1(
      packetWith({
        reviewDecision: {
          operatorDecision: 'approve-static-persistence',
          productDecision: 'approve-static-persistence',
          staticValueConfirmed: true,
        },
      }),
    );

    expect(result.status).toBe('ready-to-open-implementation-bead');
    expect(result.blockers).toEqual([]);
    expect(result.reviewNeeds).toEqual([]);
    expect(result.decisionNotes).toEqual([]);
  });

  it('does not implement when operator or product decline static persistence', () => {
    const result = evaluateGslrPersistentStaticRepositoryReviewPacketV1(
      packetWith({
        reviewDecision: {
          operatorDecision: 'decline-static-persistence',
          productDecision: 'approve-static-persistence',
          staticValueConfirmed: true,
        },
      }),
    );

    expect(result.status).toBe('do-not-implement-yet');
    expect(result.decisionNotes).toEqual(['operator declined static persistence']);
    expect(result.recommendedNextBead).toContain('Keep persistent storage blocked');
  });

  it('blocks missing or non-accepting static report attachments', () => {
    const result = evaluateGslrPersistentStaticRepositoryReviewPacketV1(
      packetWith({
        attachments: {
          staticOperatorReport: {
            attached: false,
            schemaVersion: 'missing',
            dryRunStatus: 'blocked',
            boundaryWarningsIncluded: false,
          },
          staticReviewNote: {
            attached: false,
            schemaVersion: 'missing',
            decision: 'block_static_import',
            boundaryWarningIncluded: false,
          },
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'staticOperatorReport must be attached',
      'staticOperatorReport schemaVersion must be workbench operator report v1',
      'staticOperatorReport dryRunStatus must be accepted',
      'staticOperatorReport boundary warnings must be included',
      'staticReviewNote must be attached',
      'staticReviewNote schemaVersion must be review note v1',
      'staticReviewNote decision must be accept_static_evidence_no_runtime',
      'staticReviewNote boundary warning must be included',
    ]);
  });

  it('blocks runtime scope creep and missing implementation bead safeguards', () => {
    const result = evaluateGslrPersistentStaticRepositoryReviewPacketV1(
      packetWith({
        reviewDecision: {
          persistentStorageScope: 'mc-connector-or-actions',
          runtimeIngestionDeferred: false,
        },
        implementationBead: {
          acceptanceCriteriaAttached: false,
          validationPlanAttached: false,
          rollbackPlanAttached: false,
          noRuntimeBoundaryAttached: false,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'persistentStorageScope must remain persistent-static-repository-only',
      'runtimeIngestionDeferred must be true',
      'implementation acceptance criteria must be attached',
      'implementation validation plan must be attached',
      'implementation rollback plan must be attached',
      'implementation no-runtime boundary must be attached',
    ]);
  });

  it('blocks packets derived from a blocked checkpoint', () => {
    const result = evaluateGslrPersistentStaticRepositoryReviewPacketV1(
      packetWith({
        checkpoint: {
          status: 'blocked',
          blockers: ['operatorReview must be requested or completed'],
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'checkpoint status must not be blocked',
      'checkpoint blocker: operatorReview must be requested or completed',
    ]);
  });
});

function recommendedPacket(): GslrPersistentStaticRepositoryReviewPacketV1 {
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
  expect(checkpoint.status).toBe('pause-for-operator-product-review');
  return recommendedGslrPersistentStaticRepositoryReviewPacketV1(checkpoint);
}

function packetWith(
  overrides: Partial<{
    checkpoint: Partial<GslrPersistentStaticRepositoryReviewPacketV1['checkpoint']>;
    attachments: Partial<{
      staticOperatorReport: Partial<
        GslrPersistentStaticRepositoryReviewPacketV1['attachments']['staticOperatorReport']
      >;
      staticReviewNote: Partial<
        GslrPersistentStaticRepositoryReviewPacketV1['attachments']['staticReviewNote']
      >;
    }>;
    reviewDecision: Partial<GslrPersistentStaticRepositoryReviewPacketV1['reviewDecision']>;
    implementationBead: Partial<GslrPersistentStaticRepositoryReviewPacketV1['implementationBead']>;
  }> = {},
): GslrPersistentStaticRepositoryReviewPacketV1 {
  const packet = recommendedPacket();
  return {
    ...packet,
    checkpoint: {
      ...packet.checkpoint,
      ...overrides.checkpoint,
    },
    attachments: {
      staticOperatorReport: {
        ...packet.attachments.staticOperatorReport,
        ...overrides.attachments?.staticOperatorReport,
      },
      staticReviewNote: {
        ...packet.attachments.staticReviewNote,
        ...overrides.attachments?.staticReviewNote,
      },
    },
    reviewDecision: {
      ...packet.reviewDecision,
      ...overrides.reviewDecision,
    },
    implementationBead: {
      ...packet.implementationBead,
      ...overrides.implementationBead,
    },
  };
}
