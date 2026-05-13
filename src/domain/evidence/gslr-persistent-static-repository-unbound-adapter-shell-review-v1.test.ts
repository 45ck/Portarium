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
  recommendedGslrPersistentStaticRepositoryScaffoldCodeReviewV1,
} from './gslr-persistent-static-repository-scaffold-code-review-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1,
  GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_REVIEW_V1_SCHEMA_VERSION,
  recommendedGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1,
  type GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1,
} from './gslr-persistent-static-repository-unbound-adapter-shell-review-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryUnboundAdapterShellV1,
  recommendedGslrPersistentStaticRepositoryUnboundAdapterShellV1,
} from './gslr-persistent-static-repository-unbound-adapter-shell-v1.js';

describe('GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1', () => {
  it('opens database-binding design review when the unbound shell review is clean', () => {
    const review =
      recommendedGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1(readyUnboundShell());
    const result = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1(review);

    expect(review.schemaVersion).toBe(
      GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_REVIEW_V1_SCHEMA_VERSION,
    );
    expect(result.status).toBe('ready-to-open-database-binding-design-review-bead');
    expect(result.blockers).toEqual([]);
    expect(result.reviewedEvidence).toContain('constructor boundary reviewed');
    expect(result.recommendedNextBead).toContain('database-binding design-review bead');
    expect(result.boundaryWarnings.join(' ')).toContain('approves only');
    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(result.reviewedEvidence)).toBe(true);
  });

  it('blocks when the unbound shell is not ready', () => {
    const blockedShell = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellV1({
      ...recommendedGslrPersistentStaticRepositoryUnboundAdapterShellV1(readyScaffoldCodeReview()),
      shell: {
        ...recommendedGslrPersistentStaticRepositoryUnboundAdapterShellV1(readyScaffoldCodeReview())
          .shell,
        constructorBinding: 'database-client',
      },
    });
    const result = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1(
      recommendedGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1(blockedShell),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'unboundShell status must be ready-for-unbound-adapter-shell-review',
      'unbound shell blocker: constructorBinding must be none',
    ]);
  });

  it('blocks incomplete shell review evidence', () => {
    const result = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1(
      reviewWith({
        reviewEvidence: {
          portMethodsReviewed: false,
          constructorBoundaryReviewed: false,
          transactionBoundaryReviewed: false,
          notImplementedBodiesReviewed: false,
          errorMappingSurfaceReviewed: false,
          databaseBindingTodoReviewed: false,
          contractHarnessTodoReviewed: false,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'portMethodsReviewed must be true',
      'constructorBoundaryReviewed must be true',
      'transactionBoundaryReviewed must be true',
      'notImplementedBodiesReviewed must be true',
      'errorMappingSurfaceReviewed must be true',
      'databaseBindingTodoReviewed must be true',
      'contractHarnessTodoReviewed must be true',
    ]);
  });

  it('blocks forbidden database artifacts and execution', () => {
    const result = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1(
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
    const result = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1(
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
      'engineeringDecision must approve-database-binding-design-review',
      'securityDecision must approve-database-binding-design-review',
      'operationsDecision must approve-database-binding-design-review',
      'livePromptLanguagePolling must be blocked',
      'queues must be absent',
      'sseStreams must be absent',
      'runtimeCards must be absent',
      'productionActions must be blocked',
      'mcConnectorAccess must be blocked',
    ]);
  });
});

function readyUnboundShell() {
  return evaluateGslrPersistentStaticRepositoryUnboundAdapterShellV1(
    recommendedGslrPersistentStaticRepositoryUnboundAdapterShellV1(readyScaffoldCodeReview()),
  );
}

function readyScaffoldCodeReview() {
  return evaluateGslrPersistentStaticRepositoryScaffoldCodeReviewV1(
    recommendedGslrPersistentStaticRepositoryScaffoldCodeReviewV1(readyExecutableScaffold()),
  );
}

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
    reviewEvidence: Partial<
      GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1['reviewEvidence']
    >;
    forbiddenArtifacts: Partial<
      GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1['forbiddenArtifacts']
    >;
    reviewDecision: Partial<
      GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1['reviewDecision']
    >;
    authority: Partial<GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1['authority']>;
  }>,
): GslrPersistentStaticRepositoryUnboundAdapterShellReviewV1 {
  const review =
    recommendedGslrPersistentStaticRepositoryUnboundAdapterShellReviewV1(readyUnboundShell());
  return {
    ...review,
    reviewEvidence: {
      ...review.reviewEvidence,
      ...overrides.reviewEvidence,
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
