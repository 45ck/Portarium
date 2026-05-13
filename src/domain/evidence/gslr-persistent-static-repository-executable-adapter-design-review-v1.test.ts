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
  recommendedGslrPersistentStaticRepositoryDraftSqlReviewV1,
} from './gslr-persistent-static-repository-draft-sql-review-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
  GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_DESIGN_REVIEW_V1_SCHEMA_VERSION,
  recommendedGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
  type GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
} from './gslr-persistent-static-repository-executable-adapter-design-review-v1.js';

describe('GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1', () => {
  it('opens an executable adapter scaffold bead after design-only review approval', () => {
    const review =
      recommendedGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(readySqlReview());
    const result = evaluateGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(review);

    expect(review.schemaVersion).toBe(
      GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_DESIGN_REVIEW_V1_SCHEMA_VERSION,
    );
    expect(result.status).toBe('ready-to-open-executable-adapter-scaffold-bead');
    expect(result.blockers).toEqual([]);
    expect(result.reviewedDesignArtifacts).toContain(
      'persistent static repository adapter interface mapping',
    );
    expect(result.recommendedNextBead).toContain('executable adapter scaffold bead');
    expect(result.boundaryWarnings.join(' ')).toContain('design-only');
    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(result.reviewedDesignArtifacts)).toBe(true);
  });

  it('blocks when the SQL review packet is not ready', () => {
    const blockedSqlReview = evaluateGslrPersistentStaticRepositoryDraftSqlReviewV1({
      ...recommendedGslrPersistentStaticRepositoryDraftSqlReviewV1(readyScaffold()),
      sqlSafety: {
        statementMode: 'executable',
        parameterizedStatements: false,
        rawPayloadColumn: 'present',
        productionDdl: 'present',
        productionDml: 'present',
        connectionConfig: 'present',
      },
    });
    const result = evaluateGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(
      recommendedGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(blockedSqlReview),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'sqlReview status must be ready-for-executable-adapter-design-review',
      'sql review blocker: statementMode must be draft-not-executable',
      'sql review blocker: parameterizedStatements must be true',
      'sql review blocker: rawPayloadColumn must be absent',
      'sql review blocker: productionDdl must be absent',
      'sql review blocker: productionDml must be absent',
      'sql review blocker: connectionConfig must be absent',
    ]);
  });

  it('blocks incomplete design scope and executable adapter code', () => {
    const result = evaluateGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(
      reviewWith({
        designScope: {
          adapterInterfaceMapped: false,
          transactionBoundaryMapped: false,
          idempotencyReplayMapped: false,
          conflictErrorMappingReviewed: false,
          contractHarnessBindingReviewed: false,
          observabilityPlanReviewed: false,
          executableAdapterCodeIncluded: true,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'adapterInterfaceMapped must be true',
      'transactionBoundaryMapped must be true',
      'idempotencyReplayMapped must be true',
      'conflictErrorMappingReviewed must be true',
      'contractHarnessBindingReviewed must be true',
      'observabilityPlanReviewed must be true',
      'executableAdapterCodeIncluded must be false',
    ]);
  });

  it('blocks implementation artifacts that would make the review executable', () => {
    const result = evaluateGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(
      reviewWith({
        implementationBoundary: {
          implementationMode: 'executable-adapter',
          connectionConfig: 'present',
          migrationStatus: 'applied',
          productionTablesCreated: true,
          productionWritesEnabled: true,
          generatedSqlFiles: 'present',
          secretReferences: 'present',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'implementationMode must be design-review-only',
      'connectionConfig must be absent',
      'migrationStatus must be draft-not-applied',
      'productionTablesCreated must be false',
      'productionWritesEnabled must be false',
      'generatedSqlFiles must be absent',
      'secretReferences must be absent',
    ]);
  });

  it('blocks reviewer change requests and runtime authority surfaces', () => {
    const result = evaluateGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(
      reviewWith({
        reviewDecision: {
          engineeringDecision: 'request-changes',
          securityDecision: 'request-changes',
          dataDecision: 'request-changes',
          operationsDecision: 'request-changes',
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
      'engineeringDecision must approve-scaffold-bead',
      'securityDecision must approve-scaffold-bead',
      'dataDecision must approve-scaffold-bead',
      'operationsDecision must approve-scaffold-bead',
      'livePromptLanguagePolling must be blocked',
      'queues must be absent',
      'sseStreams must be absent',
      'runtimeCards must be absent',
      'productionActions must be blocked',
      'mcConnectorAccess must be blocked',
    ]);
  });
});

function readySqlReview() {
  return evaluateGslrPersistentStaticRepositoryDraftSqlReviewV1(
    recommendedGslrPersistentStaticRepositoryDraftSqlReviewV1(readyScaffold()),
  );
}

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
    designScope: Partial<
      GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1['designScope']
    >;
    implementationBoundary: Partial<
      GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1['implementationBoundary']
    >;
    reviewDecision: Partial<
      GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1['reviewDecision']
    >;
    authority: Partial<GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1['authority']>;
  }>,
): GslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1 {
  const review =
    recommendedGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(readySqlReview());
  return {
    ...review,
    designScope: {
      ...review.designScope,
      ...overrides.designScope,
    },
    implementationBoundary: {
      ...review.implementationBoundary,
      ...overrides.implementationBoundary,
    },
    reviewDecision: {
      ...review.reviewDecision,
      ...overrides.reviewDecision,
    },
    authority: {
      ...review.authority,
      ...overrides.authority,
    },
  };
}
