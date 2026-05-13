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
  recommendedGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1,
} from './gslr-persistent-static-repository-executable-adapter-design-review-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1,
  recommendedGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1,
} from './gslr-persistent-static-repository-executable-adapter-scaffold-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryScaffoldCodeReviewV1,
  GSLR_PERSISTENT_STATIC_REPOSITORY_SCAFFOLD_CODE_REVIEW_V1_SCHEMA_VERSION,
  recommendedGslrPersistentStaticRepositoryScaffoldCodeReviewV1,
  type GslrPersistentStaticRepositoryScaffoldCodeReviewV1,
} from './gslr-persistent-static-repository-scaffold-code-review-v1.js';

describe('GslrPersistentStaticRepositoryScaffoldCodeReviewV1', () => {
  it('opens an unbound adapter shell bead when scaffold evidence stays unbound', () => {
    const review =
      recommendedGslrPersistentStaticRepositoryScaffoldCodeReviewV1(readyExecutableScaffold());
    const result = evaluateGslrPersistentStaticRepositoryScaffoldCodeReviewV1(review);

    expect(review.schemaVersion).toBe(
      GSLR_PERSISTENT_STATIC_REPOSITORY_SCAFFOLD_CODE_REVIEW_V1_SCHEMA_VERSION,
    );
    expect(result.status).toBe('ready-to-open-unbound-adapter-shell-bead');
    expect(result.blockers).toEqual([]);
    expect(result.reviewedEvidence).toContain('adapter shell reviewed');
    expect(result.recommendedNextBead).toContain('unbound adapter shell bead');
    expect(result.boundaryWarnings.join(' ')).toContain('remains unbound');
    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(result.reviewedEvidence)).toBe(true);
  });

  it('blocks when executable scaffold is not ready', () => {
    const blockedScaffold = evaluateGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1({
      ...recommendedGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(readyDesignReview()),
      persistenceBoundary: {
        migrationStatus: 'applied',
        productionTablesCreated: true,
        productionWritesEnabled: true,
        writeExecution: 'enabled',
        readExecution: 'enabled',
      },
    });
    const result = evaluateGslrPersistentStaticRepositoryScaffoldCodeReviewV1(
      recommendedGslrPersistentStaticRepositoryScaffoldCodeReviewV1(blockedScaffold),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'scaffold status must be ready-for-scaffold-code-review',
      'scaffold blocker: migrationStatus must be draft-not-applied',
      'scaffold blocker: productionTablesCreated must be false',
      'scaffold blocker: productionWritesEnabled must be false',
      'scaffold blocker: writeExecution must be blocked',
      'scaffold blocker: readExecution must be blocked',
    ]);
  });

  it('blocks incomplete code-review evidence', () => {
    const result = evaluateGslrPersistentStaticRepositoryScaffoldCodeReviewV1(
      reviewWith({
        reviewedEvidence: {
          adapterShellReviewed: false,
          portMethodSurfaceReviewed: false,
          transactionBoundaryStillUnbound: false,
          contractHarnessStillPlannedOnly: false,
          boundaryWarningsReviewed: false,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'adapterShellReviewed must be true',
      'portMethodSurfaceReviewed must be true',
      'transactionBoundaryStillUnbound must be true',
      'contractHarnessStillPlannedOnly must be true',
      'boundaryWarningsReviewed must be true',
    ]);
  });

  it('blocks forbidden database artifacts and execution', () => {
    const result = evaluateGslrPersistentStaticRepositoryScaffoldCodeReviewV1(
      reviewWith({
        forbiddenArtifacts: {
          databaseClientBinding: 'present',
          connectionConfig: 'present',
          generatedSqlFiles: 'present',
          secretReferences: 'present',
          appliedMigrations: 'present',
          productionTables: 'present',
          readExecution: 'enabled',
          writeExecution: 'enabled',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'databaseClientBinding must be absent',
      'connectionConfig must be absent',
      'generatedSqlFiles must be absent',
      'secretReferences must be absent',
      'appliedMigrations must be absent',
      'productionTables must be absent',
      'readExecution must be blocked',
      'writeExecution must be blocked',
    ]);
  });

  it('blocks reviewer change requests and runtime authority surfaces', () => {
    const result = evaluateGslrPersistentStaticRepositoryScaffoldCodeReviewV1(
      reviewWith({
        reviewDecision: {
          engineeringDecision: 'request-changes',
          securityDecision: 'request-changes',
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
      'engineeringDecision must approve-unbound-adapter-shell',
      'securityDecision must approve-unbound-adapter-shell',
      'operationsDecision must approve-unbound-adapter-shell',
      'livePromptLanguagePolling must be blocked',
      'queues must be absent',
      'sseStreams must be absent',
      'runtimeCards must be absent',
      'productionActions must be blocked',
      'mcConnectorAccess must be blocked',
    ]);
  });
});

function readyExecutableScaffold() {
  return evaluateGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(
    recommendedGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(readyDesignReview()),
  );
}

function readyDesignReview() {
  return evaluateGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(
    recommendedGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(readySqlReview()),
  );
}

function readySqlReview() {
  return evaluateGslrPersistentStaticRepositoryDraftSqlReviewV1(
    recommendedGslrPersistentStaticRepositoryDraftSqlReviewV1(readyDraftScaffold()),
  );
}

function readyDraftScaffold() {
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
    reviewedEvidence: Partial<
      GslrPersistentStaticRepositoryScaffoldCodeReviewV1['reviewedEvidence']
    >;
    forbiddenArtifacts: Partial<
      GslrPersistentStaticRepositoryScaffoldCodeReviewV1['forbiddenArtifacts']
    >;
    reviewDecision: Partial<GslrPersistentStaticRepositoryScaffoldCodeReviewV1['reviewDecision']>;
    authority: Partial<GslrPersistentStaticRepositoryScaffoldCodeReviewV1['authority']>;
  }>,
): GslrPersistentStaticRepositoryScaffoldCodeReviewV1 {
  const review =
    recommendedGslrPersistentStaticRepositoryScaffoldCodeReviewV1(readyExecutableScaffold());
  return {
    ...review,
    reviewedEvidence: {
      ...review.reviewedEvidence,
      ...overrides.reviewedEvidence,
    },
    forbiddenArtifacts: {
      ...review.forbiddenArtifacts,
      ...overrides.forbiddenArtifacts,
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
