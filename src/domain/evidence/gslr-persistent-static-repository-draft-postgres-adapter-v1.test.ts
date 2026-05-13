import { describe, expect, it } from 'vitest';
import {
  evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
  recommendedGslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
} from './gslr-persistent-static-repository-database-adapter-review-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryDraftPostgresAdapterV1,
  GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_POSTGRES_ADAPTER_V1_SCHEMA_VERSION,
  recommendedGslrPersistentStaticRepositoryDraftPostgresAdapterV1,
  type GslrPersistentStaticRepositoryDraftPostgresAdapterV1,
} from './gslr-persistent-static-repository-draft-postgres-adapter-v1.js';

describe('GslrPersistentStaticRepositoryDraftPostgresAdapterV1', () => {
  it('creates a ready draft scaffold only after the database-adapter review opens it', () => {
    const scaffold = recommendedGslrPersistentStaticRepositoryDraftPostgresAdapterV1(
      approvedDatabaseAdapterReview(),
    );
    const result = evaluateGslrPersistentStaticRepositoryDraftPostgresAdapterV1(scaffold);

    expect(scaffold.schemaVersion).toBe(
      GSLR_PERSISTENT_STATIC_REPOSITORY_DRAFT_POSTGRES_ADAPTER_V1_SCHEMA_VERSION,
    );
    expect(result.status).toBe('ready-for-draft-adapter-code-review');
    expect(result.blockers).toEqual([]);
    expect(scaffold.adapter).toEqual({
      kind: 'draft-postgres-adapter',
      implementationMode: 'contract-scaffold-only',
      connectionConfig: 'absent',
      migrationStatus: 'draft-not-applied',
      productionTablesCreated: false,
      productionWritesEnabled: false,
    });
    expect(scaffold.sqlPlan.statementMode).toBe('draft-not-executable');
    expect(scaffold.sqlPlan.parameterizedStatements).toBe(true);
    expect(scaffold.sqlPlan.rawPayloadColumn).toBe('absent');
    expect(result.boundaryWarnings.join(' ')).toContain('does not create a database connection');
    expect(Object.isFrozen(scaffold)).toBe(true);
    expect(Object.isFrozen(result.scaffoldArtifacts)).toBe(true);
  });

  it('blocks when the review checkpoint has not approved the draft adapter bead', () => {
    const pausedReview = evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(
      recommendedGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(),
    );
    const result = evaluateGslrPersistentStaticRepositoryDraftPostgresAdapterV1(
      recommendedGslrPersistentStaticRepositoryDraftPostgresAdapterV1(pausedReview),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'reviewCheckpoint status must be ready-to-open-draft-postgres-adapter-bead',
      'review checkpoint need: operator decision is requested',
      'review checkpoint need: product decision is requested',
      'review checkpoint need: engineering decision is requested',
    ]);
  });

  it('blocks executable or production-shaped adapter state', () => {
    const result = evaluateGslrPersistentStaticRepositoryDraftPostgresAdapterV1(
      scaffoldWith({
        adapter: {
          kind: 'production-postgres-adapter',
          implementationMode: 'executable-database-adapter',
          connectionConfig: 'present',
          migrationStatus: 'applied',
          productionTablesCreated: true,
          productionWritesEnabled: true,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'adapter kind must be draft-postgres-adapter',
      'adapter implementationMode must be contract-scaffold-only',
      'adapter connectionConfig must be absent',
      'adapter migrationStatus must be draft-not-applied',
      'adapter productionTablesCreated must be false',
      'adapter productionWritesEnabled must be false',
    ]);
  });

  it('blocks executable SQL, raw payload columns, missing constraints, and missing statements', () => {
    const result = evaluateGslrPersistentStaticRepositoryDraftPostgresAdapterV1(
      scaffoldWith({
        sqlPlan: {
          statementMode: 'executable',
          parameterizedStatements: false,
          tables: ['gslr_static_imported_records'],
          rawPayloadColumn: 'present',
          constraints: ['unique(idempotency_key)'],
          rollbackPlan: 'production-rollback',
          statements: ['append-static-imported-record'],
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'sqlPlan statementMode must be draft-not-executable',
      'sqlPlan parameterizedStatements must be true',
      'sqlPlan table gslr_static_imported_record_audit_events must be listed',
      'sqlPlan rawPayloadColumn must be absent',
      'sqlPlan constraint unique(record_id) must be listed',
      'sqlPlan constraint check(record_fingerprint_sha256 = sha256(canonical_json(record))) must be listed',
      'sqlPlan constraint check(raw_payload is absent) must be listed',
      'sqlPlan constraint check(review_state in constrained_static_review_states) must be listed',
      'sqlPlan rollbackPlan must be documented-drop-draft-only',
      'sqlPlan statement append-audit-event must be listed',
      'sqlPlan statement get-static-imported-record must be listed',
      'sqlPlan statement list-static-imported-records must be listed',
      'sqlPlan statement transition-review-state must be listed',
      'sqlPlan statement audit-trail-for-static-imported-record must be listed',
    ]);
  });

  it('blocks missing contract assertions and runtime authority surfaces', () => {
    const result = evaluateGslrPersistentStaticRepositoryDraftPostgresAdapterV1(
      scaffoldWith({
        contractAssertions: {
          appendAcceptedRecord: 'missing',
          idempotentReplay: 'missing',
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
      'contract assertion appendAcceptedRecord must be planned',
      'contract assertion idempotentReplay must be planned',
      'livePromptLanguagePolling must be blocked',
      'queues must be absent',
      'sseStreams must be absent',
      'runtimeCards must be absent',
      'productionActions must be blocked',
      'mcConnectorAccess must be blocked',
    ]);
  });
});

function approvedDatabaseAdapterReview() {
  const review = recommendedGslrPersistentStaticRepositoryDatabaseAdapterReviewV1();
  return evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1({
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
}

function scaffoldWith(
  overrides: Partial<{
    adapter: Partial<GslrPersistentStaticRepositoryDraftPostgresAdapterV1['adapter']>;
    sqlPlan: Partial<GslrPersistentStaticRepositoryDraftPostgresAdapterV1['sqlPlan']>;
    contractAssertions: Partial<
      GslrPersistentStaticRepositoryDraftPostgresAdapterV1['contractAssertions']
    >;
    authority: Partial<GslrPersistentStaticRepositoryDraftPostgresAdapterV1['authority']>;
  }> = {},
): GslrPersistentStaticRepositoryDraftPostgresAdapterV1 {
  const scaffold = recommendedGslrPersistentStaticRepositoryDraftPostgresAdapterV1(
    approvedDatabaseAdapterReview(),
  );
  return {
    ...scaffold,
    adapter: {
      ...scaffold.adapter,
      ...overrides.adapter,
    },
    sqlPlan: {
      ...scaffold.sqlPlan,
      ...overrides.sqlPlan,
    },
    contractAssertions: {
      ...scaffold.contractAssertions,
      ...overrides.contractAssertions,
    },
    authority: {
      ...scaffold.authority,
      ...overrides.authority,
    },
  };
}
