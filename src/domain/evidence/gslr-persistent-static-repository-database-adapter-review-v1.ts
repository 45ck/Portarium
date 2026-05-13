import type { GslrPersistentStaticRepositoryAdapterContractStatusV1 } from './gslr-persistent-static-repository-adapter-contract-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_DATABASE_ADAPTER_REVIEW_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-database-adapter-review.v1' as const;

export type GslrPersistentStaticRepositoryDatabaseAdapterReviewStatusV1 =
  | 'pause-at-contract-harness'
  | 'ready-to-open-draft-postgres-adapter-bead'
  | 'do-not-build-database-adapter'
  | 'blocked';

export type GslrPersistentStaticRepositoryDatabaseAdapterReviewDecisionV1 =
  | 'requested'
  | 'approve-draft-postgres-adapter'
  | 'decline-database-adapter';

export type GslrPersistentStaticRepositoryDatabaseAdapterReviewV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_DATABASE_ADAPTER_REVIEW_V1_SCHEMA_VERSION;
  harnessAdapter: Readonly<{
    schemaVersion:
      | 'portarium.gslr-persistent-static-repository-contract-harness-adapter.v1'
      | 'missing';
    adapterKind: 'contract-harness-only' | 'postgres-production-adapter' | 'missing';
    contractStatus: GslrPersistentStaticRepositoryAdapterContractStatusV1;
    migrationsApplied: boolean;
    productionTablesCreated: boolean;
    productionWritesEnabled: boolean;
  }>;
  reviewDecision: Readonly<{
    operatorDecision: GslrPersistentStaticRepositoryDatabaseAdapterReviewDecisionV1;
    productDecision: GslrPersistentStaticRepositoryDatabaseAdapterReviewDecisionV1;
    engineeringDecision: GslrPersistentStaticRepositoryDatabaseAdapterReviewDecisionV1;
    databaseAdapterValueConfirmed: boolean;
    contractHarnessSufficientForNow: boolean;
  }>;
  proposedNextAdapter: Readonly<{
    kind: 'none' | 'draft-postgres-adapter' | 'production-postgres-adapter';
    migrationsRemainUnapplied: boolean;
    productionWritesRemainDisabled: boolean;
    contractTestsRequired: boolean;
    rollbackPlanRequired: boolean;
  }>;
  authority: Readonly<{
    livePromptLanguagePolling: 'blocked' | 'allowed';
    queues: 'absent' | 'present';
    sseStreams: 'absent' | 'present';
    runtimeCards: 'absent' | 'present';
    productionActions: 'blocked' | 'allowed';
    mcConnectorAccess: 'blocked' | 'allowed';
  }>;
}>;

export type GslrPersistentStaticRepositoryDatabaseAdapterReviewResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_DATABASE_ADAPTER_REVIEW_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryDatabaseAdapterReviewStatusV1;
  blockers: readonly string[];
  reviewNeeds: readonly string[];
  decisionNotes: readonly string[];
  recommendedNextBead: string;
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(): GslrPersistentStaticRepositoryDatabaseAdapterReviewV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_DATABASE_ADAPTER_REVIEW_V1_SCHEMA_VERSION,
    harnessAdapter: {
      schemaVersion: 'portarium.gslr-persistent-static-repository-contract-harness-adapter.v1',
      adapterKind: 'contract-harness-only',
      contractStatus: 'ready-for-adapter-code-review',
      migrationsApplied: false,
      productionTablesCreated: false,
      productionWritesEnabled: false,
    },
    reviewDecision: {
      operatorDecision: 'requested',
      productDecision: 'requested',
      engineeringDecision: 'requested',
      databaseAdapterValueConfirmed: false,
      contractHarnessSufficientForNow: true,
    },
    proposedNextAdapter: {
      kind: 'none',
      migrationsRemainUnapplied: true,
      productionWritesRemainDisabled: true,
      contractTestsRequired: true,
      rollbackPlanRequired: true,
    },
    authority: {
      livePromptLanguagePolling: 'blocked',
      queues: 'absent',
      sseStreams: 'absent',
      runtimeCards: 'absent',
      productionActions: 'blocked',
      mcConnectorAccess: 'blocked',
    },
  });
}

export function evaluateGslrPersistentStaticRepositoryDatabaseAdapterReviewV1(
  review: GslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
): GslrPersistentStaticRepositoryDatabaseAdapterReviewResultV1 {
  assertSchemaVersion(review);
  const blockers = [
    ...harnessAdapterBlockers(review),
    ...proposedNextAdapterBlockers(review),
    ...authorityBlockers(review),
  ];
  const reviewNeeds = reviewNeedsFor(review);
  const decisionNotes = decisionNotesFor(review);
  const status = statusFor(review, blockers, reviewNeeds, decisionNotes);

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_DATABASE_ADAPTER_REVIEW_V1_SCHEMA_VERSION,
    status,
    blockers,
    reviewNeeds,
    decisionNotes,
    recommendedNextBead: nextBeadFor(status),
    boundaryWarnings: [
      'This review checkpoint decides whether to open a draft database adapter bead only.',
      'It does not apply migrations, create production tables, write production state, poll prompt-language manifests, create queues, open SSE streams, create runtime cards, execute actions, or access MC connectors.',
      'Any draft Postgres adapter must stay behind the GSLR-27 contract with migrations unapplied and production writes disabled.',
    ],
  });
}

function harnessAdapterBlockers(
  review: GslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
): string[] {
  const blockers: string[] = [];
  if (
    review.harnessAdapter.schemaVersion !==
    'portarium.gslr-persistent-static-repository-contract-harness-adapter.v1'
  ) {
    blockers.push('harnessAdapter schemaVersion must be contract harness adapter v1');
  }
  if (review.harnessAdapter.adapterKind !== 'contract-harness-only') {
    blockers.push('harnessAdapter adapterKind must be contract-harness-only');
  }
  if (review.harnessAdapter.contractStatus !== 'ready-for-adapter-code-review') {
    blockers.push('harnessAdapter contractStatus must be ready-for-adapter-code-review');
  }
  if (review.harnessAdapter.migrationsApplied) {
    blockers.push('harnessAdapter migrationsApplied must be false');
  }
  if (review.harnessAdapter.productionTablesCreated) {
    blockers.push('harnessAdapter productionTablesCreated must be false');
  }
  if (review.harnessAdapter.productionWritesEnabled) {
    blockers.push('harnessAdapter productionWritesEnabled must be false');
  }
  return blockers;
}

function proposedNextAdapterBlockers(
  review: GslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
): string[] {
  const blockers: string[] = [];
  if (review.proposedNextAdapter.kind === 'production-postgres-adapter') {
    blockers.push('proposedNextAdapter kind must not be production-postgres-adapter');
  }
  if (!review.proposedNextAdapter.migrationsRemainUnapplied) {
    blockers.push('proposedNextAdapter migrationsRemainUnapplied must be true');
  }
  if (!review.proposedNextAdapter.productionWritesRemainDisabled) {
    blockers.push('proposedNextAdapter productionWritesRemainDisabled must be true');
  }
  if (!review.proposedNextAdapter.contractTestsRequired) {
    blockers.push('proposedNextAdapter contractTestsRequired must be true');
  }
  if (!review.proposedNextAdapter.rollbackPlanRequired) {
    blockers.push('proposedNextAdapter rollbackPlanRequired must be true');
  }
  return blockers;
}

function authorityBlockers(
  review: GslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
): string[] {
  const blockers: string[] = [];
  if (review.authority.livePromptLanguagePolling !== 'blocked') {
    blockers.push('livePromptLanguagePolling must be blocked');
  }
  if (review.authority.queues !== 'absent') {
    blockers.push('queues must be absent');
  }
  if (review.authority.sseStreams !== 'absent') {
    blockers.push('sseStreams must be absent');
  }
  if (review.authority.runtimeCards !== 'absent') {
    blockers.push('runtimeCards must be absent');
  }
  if (review.authority.productionActions !== 'blocked') {
    blockers.push('productionActions must be blocked');
  }
  if (review.authority.mcConnectorAccess !== 'blocked') {
    blockers.push('mcConnectorAccess must be blocked');
  }
  return blockers;
}

function reviewNeedsFor(review: GslrPersistentStaticRepositoryDatabaseAdapterReviewV1): string[] {
  const needs: string[] = [];
  if (review.reviewDecision.operatorDecision === 'requested') {
    needs.push('operator decision is requested');
  }
  if (review.reviewDecision.productDecision === 'requested') {
    needs.push('product decision is requested');
  }
  if (review.reviewDecision.engineeringDecision === 'requested') {
    needs.push('engineering decision is requested');
  }
  if (
    review.proposedNextAdapter.kind === 'draft-postgres-adapter' &&
    !review.reviewDecision.databaseAdapterValueConfirmed
  ) {
    needs.push('database adapter value must be confirmed for draft Postgres adapter');
  }
  if (
    review.proposedNextAdapter.kind === 'draft-postgres-adapter' &&
    review.reviewDecision.contractHarnessSufficientForNow
  ) {
    needs.push('contract harness sufficiency must be rejected for draft Postgres adapter');
  }
  return needs;
}

function decisionNotesFor(review: GslrPersistentStaticRepositoryDatabaseAdapterReviewV1): string[] {
  const notes: string[] = [];
  for (const [role, decision] of Object.entries(review.reviewDecision)) {
    if (decision === 'decline-database-adapter') {
      notes.push(`${role} declined database adapter`);
    }
  }
  return notes;
}

function statusFor(
  review: GslrPersistentStaticRepositoryDatabaseAdapterReviewV1,
  blockers: readonly string[],
  reviewNeeds: readonly string[],
  decisionNotes: readonly string[],
): GslrPersistentStaticRepositoryDatabaseAdapterReviewStatusV1 {
  if (blockers.length > 0) return 'blocked';
  if (decisionNotes.length > 0) return 'do-not-build-database-adapter';
  if (reviewNeeds.length > 0 || review.proposedNextAdapter.kind === 'none') {
    return 'pause-at-contract-harness';
  }
  return 'ready-to-open-draft-postgres-adapter-bead';
}

function nextBeadFor(status: GslrPersistentStaticRepositoryDatabaseAdapterReviewStatusV1): string {
  if (status === 'ready-to-open-draft-postgres-adapter-bead') {
    return 'Open a draft Postgres adapter bead behind the GSLR-27 contract, with migrations unapplied and production writes disabled.';
  }
  if (status === 'do-not-build-database-adapter') {
    return 'Keep the contract-harness adapter as the stopping point for now.';
  }
  if (status === 'pause-at-contract-harness') {
    return 'Complete database-adapter review before opening any Postgres adapter work.';
  }
  return 'Clear review checkpoint blockers before database adapter work continues.';
}

function assertSchemaVersion(review: GslrPersistentStaticRepositoryDatabaseAdapterReviewV1) {
  if (
    review.schemaVersion !==
    GSLR_PERSISTENT_STATIC_REPOSITORY_DATABASE_ADAPTER_REVIEW_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_DATABASE_ADAPTER_REVIEW_V1_SCHEMA_VERSION}`,
    );
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}
