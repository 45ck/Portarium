import { describe, expect, it } from 'vitest';
import {
  evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
  recommendedGslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
} from './gslr-persistent-static-repository-database-adapter-review-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryDraftPostgresAdapterV1,
  recommendedGslrPersistentStaticRepositoryDraftPostgresAdapterV1,
} from './gslr-persistent-static-repository-draft-postgres-adapter-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryDraftSqlReviewV1,
  GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_SQL_REVIEW_V1_SCHEMA_VERSION,
  recommendedGslrPersistentStaticRepositoryDraftSqlReviewV1,
  type GslrPersistentStaticRepositoryDraftSqlReviewV1,
} from './gslr-persistent-static-repository-draft-sql-review-v1.js';

describe('GslrPersistentStaticRepositoryDraftSqlReviewV1', () => {
  it('approves the next design-review bead after reviewing the draft SQL scaffold', () => {
    const review = recommendedGslrPersistentStaticRepositoryDraftSqlReviewV1(readyScaffold());
    const result = evaluateGslrPersistentStaticRepositoryDraftSqlReviewV1(review);

    expect(review.schemaVersion).toBe(
      GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_SQL_REVIEW_V1_SCHEMA_VERSION,
    );
    expect(result.status).toBe('ready-for-executable-adapter-design-review');
    expect(result.blockers).toEqual([]);
    expect(result.reviewedArtifacts).toContain('draft PostgreSQL statement plan');
    expect(result.recommendedNextBead).toContain('executable adapter design-review bead');
    expect(result.boundaryWarnings.join(' ')).toContain('does not create executable adapter code');
    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(result.reviewedArtifacts)).toBe(true);
  });

  it('blocks when the draft adapter scaffold is not ready', () => {
    const pausedReview = evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(
      recommendedGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(),
    );
    const blockedScaffold = evaluateGslrPersistentStaticRepositoryDraftPostgresAdapterV1(
      recommendedGslrPersistentStaticRepositoryDraftPostgresAdapterV1(pausedReview),
    );
    const result = evaluateGslrPersistentStaticRepositoryDraftSqlReviewV1(
      recommendedGslrPersistentStaticRepositoryDraftSqlReviewV1(blockedScaffold),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'scaffold status must be ready-for-draft-adapter-code-review',
      'scaffold blocker: reviewCheckpoint status must be ready-to-open-draft-postgres-adapter-bead',
      'scaffold blocker: review checkpoint need: operator decision is requested',
      'scaffold blocker: review checkpoint need: product decision is requested',
      'scaffold blocker: review checkpoint need: engineering decision is requested',
    ]);
  });

  it('blocks incomplete review scope and included executable adapter code', () => {
    const result = evaluateGslrPersistentStaticRepositoryDraftSqlReviewV1(
      reviewWith({
        reviewScope: {
          tableMappingReviewed: false,
          statementPlanReviewed: false,
          constraintSetReviewed: false,
          rollbackPostureReviewed: false,
          contractAssertionCoverageReviewed: false,
          executableAdapterCodeIncluded: true,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'tableMappingReviewed must be true',
      'statementPlanReviewed must be true',
      'constraintSetReviewed must be true',
      'rollbackPostureReviewed must be true',
      'contractAssertionCoverageReviewed must be true',
      'executableAdapterCodeIncluded must be false',
    ]);
  });

  it('blocks unsafe SQL posture and connection configuration', () => {
    const result = evaluateGslrPersistentStaticRepositoryDraftSqlReviewV1(
      reviewWith({
        sqlSafety: {
          statementMode: 'executable',
          parameterizedStatements: false,
          rawPayloadColumn: 'present',
          productionDdl: 'present',
          productionDml: 'present',
          connectionConfig: 'present',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'statementMode must be draft-not-executable',
      'parameterizedStatements must be true',
      'rawPayloadColumn must be absent',
      'productionDdl must be absent',
      'productionDml must be absent',
      'connectionConfig must be absent',
    ]);
  });

  it('blocks reviewer change requests and runtime authority surfaces', () => {
    const result = evaluateGslrPersistentStaticRepositoryDraftSqlReviewV1(
      reviewWith({
        reviewerDecision: {
          engineeringDecision: 'request-changes',
          securityDecision: 'request-changes',
          dataDecision: 'request-changes',
        },
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
      'engineeringDecision must approve-next-design-review',
      'securityDecision must approve-next-design-review',
      'dataDecision must approve-next-design-review',
      'livePromptLanguagePolling must be blocked',
      'queues must be absent',
      'sseStreams must be absent',
      'runtimeCards must be absent',
      'productionActions must be blocked',
      'mcConnectorAccess must be blocked',
    ]);
  });
});

function readyScaffold() {
  const review = recommendedGslrPersistentStaticRepositoryDatabaseAdapterReviewV1();
  const approvedReview = evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1({
    ...review,
    reviewDecision: {
      operatorDecision: 'approve-draft-postgres-adapter',
      productDecision: 'approve-draft-postgres-adapter',
      engineeringDecision: 'approve-draft-postgres-adapter',
      databaseAdapterValueConfirmed: true,
      contractHarnessSufficientForNow: false,
    },
    proposedNextAdapter: {
      ...review.proposedNextAdapter,
      kind: 'draft-postgres-adapter',
    },
  });
  return evaluateGslrPersistentStaticRepositoryDraftPostgresAdapterV1(
    recommendedGslrPersistentStaticRepositoryDraftPostgresAdapterV1(approvedReview),
  );
}

function reviewWith(
  overrides: Partial<{
    reviewScope: Partial<GslrPersistentStaticRepositoryDraftSqlReviewV1['reviewScope']>;
    sqlSafety: Partial<GslrPersistentStaticRepositoryDraftSqlReviewV1['sqlSafety']>;
    reviewerDecision: Partial<GslrPersistentStaticRepositoryDraftSqlReviewV1['reviewerDecision']>;
    authority: Partial<GslrPersistentStaticRepositoryDraftSqlReviewV1['authority']>;
  }>,
): GslrPersistentStaticRepositoryDraftSqlReviewV1 {
  const review = recommendedGslrPersistentStaticRepositoryDraftSqlReviewV1(readyScaffold());
  return {
    ...review,
    reviewScope: {
      ...review.reviewScope,
      ...overrides.reviewScope,
    },
    sqlSafety: {
      ...review.sqlSafety,
      ...overrides.sqlSafety,
    },
    reviewerDecision: {
      ...review.reviewerDecision,
      ...overrides.reviewerDecision,
    },
    authority: {
      ...review.authority,
      ...overrides.authority,
    },
  };
}
