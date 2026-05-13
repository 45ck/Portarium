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
  evaluateGslrPersistentStaticRepositoryUnboundAdapterShellV1,
  GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_V1_SCHEMA_VERSION,
  recommendedGslrPersistentStaticRepositoryUnboundAdapterShellV1,
  type GslrPersistentStaticRepositoryUnboundAdapterShellV1,
} from './gslr-persistent-static-repository-unbound-adapter-shell-v1.js';

describe('GslrPersistentStaticRepositoryUnboundAdapterShellV1', () => {
  it('opens shell review when the unbound adapter shell remains non-operational', () => {
    const shell =
      recommendedGslrPersistentStaticRepositoryUnboundAdapterShellV1(readyScaffoldCodeReview());
    const result = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellV1(shell);

    expect(shell.schemaVersion).toBe(
      GSLR_PERSISTENT_STATIC_REPOSITORY_UNBOUND_ADAPTER_SHELL_V1_SCHEMA_VERSION,
    );
    expect(result.status).toBe('ready-for-unbound-adapter-shell-review');
    expect(result.blockers).toEqual([]);
    expect(result.shellArtifacts).toContain('persistent static repository port method exports');
    expect(result.recommendedNextBead).toContain('unbound adapter shell review bead');
    expect(result.boundaryWarnings.join(' ')).toContain('intentionally unbound');
    expect(Object.isFrozen(shell)).toBe(true);
    expect(Object.isFrozen(result.shellArtifacts)).toBe(true);
  });

  it('blocks when scaffold code review is not ready', () => {
    const blockedReview = evaluateGslrPersistentStaticRepositoryScaffoldCodeReviewV1({
      ...recommendedGslrPersistentStaticRepositoryScaffoldCodeReviewV1(readyExecutableScaffold()),
      reviewedEvidence: {
        adapterShellReviewed: false,
        portMethodSurfaceReviewed: true,
        transactionBoundaryStillUnbound: true,
        contractHarnessStillPlannedOnly: true,
        boundaryWarningsReviewed: true,
      },
    });
    const result = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellV1(
      recommendedGslrPersistentStaticRepositoryUnboundAdapterShellV1(blockedReview),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'scaffoldCodeReview status must be ready-to-open-unbound-adapter-shell-bead',
      'scaffold code review blocker: adapterShellReviewed must be true',
    ]);
  });

  it('blocks shell drift into database-bound behavior', () => {
    const result = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellV1(
      shellWith({
        shell: {
          implementationMode: 'database-bound',
          exportedPortMethods: ['appendStaticImportedRecord'],
          constructorBinding: 'database-client',
          transactionBoundary: 'bound',
          methodBodies: 'execute-database',
          errorMapping: 'executable',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'implementationMode must be unbound-shell-only',
      'exported port method getStaticImportedRecord must be present',
      'exported port method listStaticImportedRecords must be present',
      'exported port method transitionStaticImportedRecordReviewState must be present',
      'exported port method auditTrailForStaticImportedRecord must be present',
      'constructorBinding must be none',
      'transactionBoundary must be declared-not-bound',
      'methodBodies must be throw-not-implemented',
      'errorMapping must be declared-only',
    ]);
  });

  it('blocks forbidden database artifacts and execution', () => {
    const result = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellV1(
      shellWith({
        databaseArtifacts: {
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

  it('blocks hidden review surfaces and runtime authority', () => {
    const result = evaluateGslrPersistentStaticRepositoryUnboundAdapterShellV1(
      shellWith({
        reviewSurface: {
          portShapeVisible: false,
          constructorBoundaryVisible: false,
          transactionBoundaryVisible: false,
          databaseBindingTodoVisible: false,
          contractHarnessTodoVisible: false,
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
      'portShapeVisible must be true',
      'constructorBoundaryVisible must be true',
      'transactionBoundaryVisible must be true',
      'databaseBindingTodoVisible must be true',
      'contractHarnessTodoVisible must be true',
      'livePromptLanguagePolling must be blocked',
      'queues must be absent',
      'sseStreams must be absent',
      'runtimeCards must be absent',
      'productionActions must be blocked',
      'mcConnectorAccess must be blocked',
    ]);
  });
});

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

function shellWith(
  overrides: Partial<{
    shell: Partial<GslrPersistentStaticRepositoryUnboundAdapterShellV1['shell']>;
    databaseArtifacts: Partial<
      GslrPersistentStaticRepositoryUnboundAdapterShellV1['databaseArtifacts']
    >;
    reviewSurface: Partial<GslrPersistentStaticRepositoryUnboundAdapterShellV1['reviewSurface']>;
    authority: Partial<GslrPersistentStaticRepositoryUnboundAdapterShellV1['authority']>;
  }>,
): GslrPersistentStaticRepositoryUnboundAdapterShellV1 {
  const shell =
    recommendedGslrPersistentStaticRepositoryUnboundAdapterShellV1(readyScaffoldCodeReview());
  return {
    ...shell,
    shell: {
      ...shell.shell,
      ...overrides.shell,
    },
    databaseArtifacts: {
      ...shell.databaseArtifacts,
      ...overrides.databaseArtifacts,
    },
    reviewSurface: {
      ...shell.reviewSurface,
      ...overrides.reviewSurface,
    },
    authority: {
      ...shell.authority,
      ...overrides.authority,
    },
  };
}
