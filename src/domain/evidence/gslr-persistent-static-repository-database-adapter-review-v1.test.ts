import { describe, expect, it } from 'vitest';
import {
  evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
  recommendedGslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
  type GslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
} from './gslr-persistent-static-repository-database-adapter-review-v1.js';

describe('GslrPersistentStaticRepositoryDatabaseAdapterReviewV1', () => {
  it('pauses at the contract harness by default', () => {
    const review = recommendedGslrPersistentStaticRepositoryDatabaseAdapterReviewV1();
    const result = evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(review);

    expect(result.status).toBe('pause-at-contract-harness');
    expect(result.blockers).toEqual([]);
    expect(result.reviewNeeds).toEqual([
      'operator decision is requested',
      'product decision is requested',
      'engineering decision is requested',
    ]);
    expect(result.recommendedNextBead).toContain('Complete database-adapter review');
    expect(result.boundaryWarnings.join(' ')).toContain('does not apply migrations');
    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(result.reviewNeeds)).toBe(true);
  });

  it('opens only a draft Postgres adapter after explicit review approval', () => {
    const result = evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(
      reviewWith({
        reviewDecision: {
          operatorDecision: 'approve-draft-postgres-adapter',
          productDecision: 'approve-draft-postgres-adapter',
          engineeringDecision: 'approve-draft-postgres-adapter',
          databaseAdapterValueConfirmed: true,
          contractHarnessSufficientForNow: false,
        },
        proposedNextAdapter: {
          kind: 'draft-postgres-adapter',
        },
      }),
    );

    expect(result.status).toBe('ready-to-open-draft-postgres-adapter-bead');
    expect(result.blockers).toEqual([]);
    expect(result.reviewNeeds).toEqual([]);
    expect(result.recommendedNextBead).toContain('draft Postgres adapter');
  });

  it('pauses when a draft adapter is proposed but the harness is still sufficient', () => {
    const result = evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(
      reviewWith({
        reviewDecision: {
          operatorDecision: 'approve-draft-postgres-adapter',
          productDecision: 'approve-draft-postgres-adapter',
          engineeringDecision: 'approve-draft-postgres-adapter',
          databaseAdapterValueConfirmed: true,
          contractHarnessSufficientForNow: true,
        },
        proposedNextAdapter: {
          kind: 'draft-postgres-adapter',
        },
      }),
    );

    expect(result.status).toBe('pause-at-contract-harness');
    expect(result.reviewNeeds).toEqual([
      'contract harness sufficiency must be rejected for draft Postgres adapter',
    ]);
  });

  it('treats declined database adapter review as a valid stop decision', () => {
    const result = evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(
      reviewWith({
        reviewDecision: {
          operatorDecision: 'decline-database-adapter',
          productDecision: 'approve-draft-postgres-adapter',
          engineeringDecision: 'approve-draft-postgres-adapter',
          databaseAdapterValueConfirmed: true,
          contractHarnessSufficientForNow: true,
        },
      }),
    );

    expect(result.status).toBe('do-not-build-database-adapter');
    expect(result.decisionNotes).toEqual(['operatorDecision declined database adapter']);
    expect(result.recommendedNextBead).toContain('contract-harness adapter');
  });

  it('blocks invalid harness metadata and production state', () => {
    const result = evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(
      reviewWith({
        harnessAdapter: {
          schemaVersion: 'missing',
          adapterKind: 'postgres-production-adapter',
          contractStatus: 'blocked',
          migrationsApplied: true,
          productionTablesCreated: true,
          productionWritesEnabled: true,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'harnessAdapter schemaVersion must be contract harness adapter v1',
      'harnessAdapter adapterKind must be contract-harness-only',
      'harnessAdapter contractStatus must be ready-for-adapter-code-review',
      'harnessAdapter migrationsApplied must be false',
      'harnessAdapter productionTablesCreated must be false',
      'harnessAdapter productionWritesEnabled must be false',
    ]);
  });

  it('blocks production Postgres adapter scope and missing safeguards', () => {
    const result = evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(
      reviewWith({
        proposedNextAdapter: {
          kind: 'production-postgres-adapter',
          migrationsRemainUnapplied: false,
          productionWritesRemainDisabled: false,
          contractTestsRequired: false,
          rollbackPlanRequired: false,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'proposedNextAdapter kind must not be production-postgres-adapter',
      'proposedNextAdapter migrationsRemainUnapplied must be true',
      'proposedNextAdapter productionWritesRemainDisabled must be true',
      'proposedNextAdapter contractTestsRequired must be true',
      'proposedNextAdapter rollbackPlanRequired must be true',
    ]);
  });

  it('blocks runtime authority surfaces', () => {
    const result = evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(
      reviewWith({
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

function reviewWith(
  overrides: Partial<{
    harnessAdapter: Partial<
      GslrPersistentStaticRepositoryDatabaseAdapterReviewV1['harnessAdapter']
    >;
    reviewDecision: Partial<
      GslrPersistentStaticRepositoryDatabaseAdapterReviewV1['reviewDecision']
    >;
    proposedNextAdapter: Partial<
      GslrPersistentStaticRepositoryDatabaseAdapterReviewV1['proposedNextAdapter']
    >;
    authority: Partial<GslrPersistentStaticRepositoryDatabaseAdapterReviewV1['authority']>;
  }> = {},
): GslrPersistentStaticRepositoryDatabaseAdapterReviewV1 {
  const review = recommendedGslrPersistentStaticRepositoryDatabaseAdapterReviewV1();
  return {
    ...review,
    harnessAdapter: {
      ...review.harnessAdapter,
      ...overrides.harnessAdapter,
    },
    reviewDecision: {
      ...review.reviewDecision,
      ...overrides.reviewDecision,
    },
    proposedNextAdapter: {
      ...review.proposedNextAdapter,
      ...overrides.proposedNextAdapter,
    },
    authority: {
      ...review.authority,
      ...overrides.authority,
    },
  };
}
