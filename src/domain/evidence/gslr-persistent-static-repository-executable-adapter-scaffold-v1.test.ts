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
  GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_SCAFFOLD_V1_SCHEMA_VERSION,
  recommendedGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1,
  type GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1,
} from './gslr-persistent-static-repository-executable-adapter-scaffold-v1.js';

describe('GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1', () => {
  it('creates a scaffold that names the adapter surface without database binding', () => {
    const scaffold =
      recommendedGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(readyDesignReview());
    const result = evaluateGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(scaffold);

    expect(scaffold.schemaVersion).toBe(
      GSLR_PERSISTENT_STATIC_REPOSITORY_EXECUTABLE_ADAPTER_SCAFFOLD_V1_SCHEMA_VERSION,
    );
    expect(result.status).toBe('ready-for-scaffold-code-review');
    expect(result.blockers).toEqual([]);
    expect(scaffold.scaffold).toEqual({
      adapterName: 'GslrPersistentStaticRepositoryPostgresAdapter',
      implementationMode: 'scaffold-only',
      portMethods: [
        'appendStaticImportedRecord',
        'getStaticImportedRecord',
        'listStaticImportedRecords',
        'transitionStaticImportedRecordReviewState',
        'auditTrailForStaticImportedRecord',
      ],
      transactionBoundary: 'planned-not-bound',
      databaseClientBinding: 'absent',
      connectionConfig: 'absent',
      generatedSqlFiles: 'absent',
      secretReferences: 'absent',
    });
    expect(result.recommendedNextBead).toContain('scaffold code review bead');
    expect(result.boundaryWarnings.join(' ')).toContain('does not bind a database client');
    expect(Object.isFrozen(scaffold)).toBe(true);
    expect(Object.isFrozen(result.scaffoldArtifacts)).toBe(true);
  });

  it('blocks when the design review is not ready', () => {
    const blockedDesign = evaluateGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1({
      ...recommendedGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(readySqlReview()),
      designScope: {
        adapterInterfaceMapped: false,
        transactionBoundaryMapped: false,
        idempotencyReplayMapped: false,
        conflictErrorMappingReviewed: false,
        contractHarnessBindingReviewed: false,
        observabilityPlanReviewed: false,
        executableAdapterCodeIncluded: true,
      },
    });
    const result = evaluateGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(
      recommendedGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(blockedDesign),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'designReview status must be ready-to-open-executable-adapter-scaffold-bead',
      'design review blocker: adapterInterfaceMapped must be true',
      'design review blocker: transactionBoundaryMapped must be true',
      'design review blocker: idempotencyReplayMapped must be true',
      'design review blocker: conflictErrorMappingReviewed must be true',
      'design review blocker: contractHarnessBindingReviewed must be true',
      'design review blocker: observabilityPlanReviewed must be true',
      'design review blocker: executableAdapterCodeIncluded must be false',
    ]);
  });

  it('blocks executable implementation scaffold state and missing port methods', () => {
    const result = evaluateGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(
      scaffoldWith({
        scaffold: {
          implementationMode: 'database-executable',
          portMethods: ['appendStaticImportedRecord'],
          transactionBoundary: 'bound',
          databaseClientBinding: 'present',
          connectionConfig: 'present',
          generatedSqlFiles: 'present',
          secretReferences: 'present',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'implementationMode must be scaffold-only',
      'port method getStaticImportedRecord must be present',
      'port method listStaticImportedRecords must be present',
      'port method transitionStaticImportedRecordReviewState must be present',
      'port method auditTrailForStaticImportedRecord must be present',
      'transactionBoundary must be planned-not-bound',
      'databaseClientBinding must be absent',
      'connectionConfig must be absent',
      'generatedSqlFiles must be absent',
      'secretReferences must be absent',
    ]);
  });

  it('blocks persistence execution and executed contract harness binding', () => {
    const result = evaluateGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(
      scaffoldWith({
        persistenceBoundary: {
          migrationStatus: 'applied',
          productionTablesCreated: true,
          productionWritesEnabled: true,
          writeExecution: 'enabled',
          readExecution: 'enabled',
        },
        contractHarness: {
          bindingMode: 'executed-against-database',
          casesMapped: false,
          rawPayloadRejectionMapped: false,
          idempotencyConflictMapped: false,
          recordIdConflictMapped: false,
          auditAppendOnlyMapped: false,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'migrationStatus must be draft-not-applied',
      'productionTablesCreated must be false',
      'productionWritesEnabled must be false',
      'writeExecution must be blocked',
      'readExecution must be blocked',
      'contractHarness bindingMode must be planned-not-executed',
      'contractHarness casesMapped must be true',
      'contractHarness rawPayloadRejectionMapped must be true',
      'contractHarness idempotencyConflictMapped must be true',
      'contractHarness recordIdConflictMapped must be true',
      'contractHarness auditAppendOnlyMapped must be true',
    ]);
  });

  it('blocks runtime authority surfaces', () => {
    const result = evaluateGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(
      scaffoldWith({
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

function readyDesignReview() {
  return evaluateGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(
    recommendedGslrPersistentStaticRepositoryExecutableAdapterDesignReviewV1(readySqlReview()),
  );
}

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

function scaffoldWith(
  overrides: Partial<{
    scaffold: Partial<GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1['scaffold']>;
    persistenceBoundary: Partial<
      GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1['persistenceBoundary']
    >;
    contractHarness: Partial<
      GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1['contractHarness']
    >;
    authority: Partial<GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1['authority']>;
  }>,
): GslrPersistentStaticRepositoryExecutableAdapterScaffoldV1 {
  const scaffold =
    recommendedGslrPersistentStaticRepositoryExecutableAdapterScaffoldV1(readyDesignReview());
  return {
    ...scaffold,
    scaffold: {
      ...scaffold.scaffold,
      ...overrides.scaffold,
    },
    persistenceBoundary: {
      ...scaffold.persistenceBoundary,
      ...overrides.persistenceBoundary,
    },
    contractHarness: {
      ...scaffold.contractHarness,
      ...overrides.contractHarness,
    },
    authority: {
      ...scaffold.authority,
      ...overrides.authority,
    },
  };
}
