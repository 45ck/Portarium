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
  evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1,
  recommendedGslrPersistentStaticRepositoryStopReviewCheckpointV1,
  type GslrPersistentStaticRepositoryStopReviewCheckpointV1,
} from './gslr-persistent-static-repository-stop-review-checkpoint-v1.js';
import {
  evaluateGslrStaticImportVerificationDesignV1,
  recommendedGslrStaticImportVerificationDesignV1,
} from './gslr-static-import-verification-design-v1.js';

describe('GslrPersistentStaticRepositoryStopReviewCheckpointV1', () => {
  it('pauses the recommended checkpoint for operator and product review', () => {
    const checkpoint = recommendedCheckpoint();
    const result = evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1(checkpoint);

    expect(result.status).toBe('pause-for-operator-product-review');
    expect(result.blockers).toEqual([]);
    expect(result.reviewNeeds).toEqual([
      'operator review must sign off on static-only persistence scope',
      'product review must confirm persistent storage is useful before runtime ingestion',
    ]);
    expect(result.conclusion).toContain('Stop broad research');
    expect(result.recommendedNextBead).toContain('Run operator/product review');
    expect(result.boundaryWarnings.join(' ')).toContain('does not add database migrations');
    expect(Object.isFrozen(checkpoint)).toBe(true);
    expect(Object.isFrozen(result.reviewNeeds)).toBe(true);
  });

  it('opens implementation only after operator and product review are completed', () => {
    const result = evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1(
      checkpointWith({
        reviewPosture: {
          operatorReview: 'completed',
          productReview: 'completed',
        },
      }),
    );

    expect(result.status).toBe('open-implementation-bead');
    expect(result.blockers).toEqual([]);
    expect(result.reviewNeeds).toEqual([]);
    expect(result.recommendedNextBead).toContain('Open the persistent static repository');
  });

  it('blocks implementation when readiness is still blocked', () => {
    const result = evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1(
      checkpointWith({
        implementationReadiness: {
          status: 'blocked',
          blockers: ['productionTables must be absent for readiness review'],
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'implementationReadiness status must be ready-to-open-implementation-bead',
      'readiness blocker: productionTables must be absent for readiness review',
    ]);
  });

  it('blocks open research questions, missing reviews, and runtime scope creep', () => {
    const result = evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1(
      checkpointWith({
        reviewPosture: {
          researchStatus: 'open-research-question',
          operatorReview: 'missing',
          productReview: 'missing',
          implementationScope: 'runtime-ingestion',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'researchStatus must be complete-enough-for-engineering',
      'operatorReview must be requested or completed',
      'productReview must be requested or completed',
      'implementationScope must remain persistent-static-repository-only',
    ]);
  });

  it('blocks missing exit criteria before implementation can open', () => {
    const result = evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1(
      checkpointWith({
        reviewPosture: {
          operatorReview: 'completed',
          productReview: 'completed',
        },
        exitCriteria: {
          implementationBeadAcceptanceCriteria: 'missing',
          validationPlan: 'missing',
          rollbackPlan: 'missing',
          noRuntimeBoundary: 'missing',
          commitAndPushPlan: 'missing',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'implementationBeadAcceptanceCriteria must be specified',
      'validationPlan must be specified',
      'rollbackPlan must be specified',
      'noRuntimeBoundary must be documented',
      'commitAndPushPlan must be specified',
    ]);
  });
});

function recommendedCheckpoint(): GslrPersistentStaticRepositoryStopReviewCheckpointV1 {
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
  expect(readiness.status).toBe('ready-to-open-implementation-bead');
  return recommendedGslrPersistentStaticRepositoryStopReviewCheckpointV1(readiness);
}

function checkpointWith(
  overrides: Partial<{
    implementationReadiness: Partial<
      GslrPersistentStaticRepositoryStopReviewCheckpointV1['implementationReadiness']
    >;
    reviewPosture: Partial<GslrPersistentStaticRepositoryStopReviewCheckpointV1['reviewPosture']>;
    exitCriteria: Partial<GslrPersistentStaticRepositoryStopReviewCheckpointV1['exitCriteria']>;
  }> = {},
): GslrPersistentStaticRepositoryStopReviewCheckpointV1 {
  const checkpoint = recommendedCheckpoint();
  return {
    ...checkpoint,
    implementationReadiness: {
      ...checkpoint.implementationReadiness,
      ...overrides.implementationReadiness,
    },
    reviewPosture: {
      ...checkpoint.reviewPosture,
      ...overrides.reviewPosture,
    },
    exitCriteria: {
      ...checkpoint.exitCriteria,
      ...overrides.exitCriteria,
    },
  };
}
