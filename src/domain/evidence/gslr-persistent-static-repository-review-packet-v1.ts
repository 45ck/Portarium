import type {
  GslrPersistentStaticRepositoryStopReviewCheckpointResultV1,
  GslrPersistentStaticRepositoryStopReviewCheckpointStatusV1,
} from './gslr-persistent-static-repository-stop-review-checkpoint-v1.js';

export const GSLR_PERSISTENT_STATIC_REPOSITORY_REVIEW_PACKET_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-repository-review-packet.v1' as const;

export type GslrPersistentStaticRepositoryReviewPacketStatusV1 =
  | 'ready-for-static-review'
  | 'ready-to-open-implementation-bead'
  | 'do-not-implement-yet'
  | 'blocked';

export type GslrPersistentStaticRepositoryReviewDecisionV1 =
  | 'requested'
  | 'approve-static-persistence'
  | 'decline-static-persistence';

export type GslrPersistentStaticRepositoryReviewPacketV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_REVIEW_PACKET_V1_SCHEMA_VERSION;
  checkpoint: Readonly<{
    status: GslrPersistentStaticRepositoryStopReviewCheckpointStatusV1;
    blockers: readonly string[];
    reviewNeeds: readonly string[];
  }>;
  attachments: Readonly<{
    staticOperatorReport: Readonly<{
      attached: boolean;
      schemaVersion: 'portarium.gslr-static-evidence-workbench-operator-report.v1' | 'missing';
      dryRunStatus: 'accepted' | 'blocked' | 'quarantined' | 'missing';
      boundaryWarningsIncluded: boolean;
    }>;
    staticReviewNote: Readonly<{
      attached: boolean;
      schemaVersion: 'portarium.gslr-static-evidence-review-note.v1' | 'missing';
      decision:
        | 'accept_static_evidence_no_runtime'
        | 'attach_static_report_only'
        | 'block_static_import'
        | 'quarantine_static_rejected'
        | 'missing';
      boundaryWarningIncluded: boolean;
    }>;
  }>;
  reviewDecision: Readonly<{
    operatorDecision: GslrPersistentStaticRepositoryReviewDecisionV1;
    productDecision: GslrPersistentStaticRepositoryReviewDecisionV1;
    staticValueConfirmed: boolean;
    runtimeIngestionDeferred: boolean;
    persistentStorageScope:
      | 'persistent-static-repository-only'
      | 'runtime-ingestion'
      | 'mc-connector-or-actions';
  }>;
  implementationBead: Readonly<{
    acceptanceCriteriaAttached: boolean;
    validationPlanAttached: boolean;
    rollbackPlanAttached: boolean;
    noRuntimeBoundaryAttached: boolean;
  }>;
}>;

export type GslrPersistentStaticRepositoryReviewPacketResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_REPOSITORY_REVIEW_PACKET_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticRepositoryReviewPacketStatusV1;
  blockers: readonly string[];
  reviewNeeds: readonly string[];
  decisionNotes: readonly string[];
  recommendedNextBead: string;
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticRepositoryReviewPacketV1(
  checkpoint: GslrPersistentStaticRepositoryStopReviewCheckpointResultV1,
): GslrPersistentStaticRepositoryReviewPacketV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_REVIEW_PACKET_V1_SCHEMA_VERSION,
    checkpoint: {
      status: checkpoint.status,
      blockers: checkpoint.blockers,
      reviewNeeds: checkpoint.reviewNeeds,
    },
    attachments: {
      staticOperatorReport: {
        attached: true,
        schemaVersion: 'portarium.gslr-static-evidence-workbench-operator-report.v1',
        dryRunStatus: 'accepted',
        boundaryWarningsIncluded: true,
      },
      staticReviewNote: {
        attached: true,
        schemaVersion: 'portarium.gslr-static-evidence-review-note.v1',
        decision: 'accept_static_evidence_no_runtime',
        boundaryWarningIncluded: true,
      },
    },
    reviewDecision: {
      operatorDecision: 'requested',
      productDecision: 'requested',
      staticValueConfirmed: false,
      runtimeIngestionDeferred: true,
      persistentStorageScope: 'persistent-static-repository-only',
    },
    implementationBead: {
      acceptanceCriteriaAttached: true,
      validationPlanAttached: true,
      rollbackPlanAttached: true,
      noRuntimeBoundaryAttached: true,
    },
  });
}

export function evaluateGslrPersistentStaticRepositoryReviewPacketV1(
  packet: GslrPersistentStaticRepositoryReviewPacketV1,
): GslrPersistentStaticRepositoryReviewPacketResultV1 {
  assertSchemaVersion(packet);
  const blockers = [
    ...checkpointBlockers(packet),
    ...attachmentBlockers(packet),
    ...decisionBlockers(packet),
    ...implementationBeadBlockers(packet),
  ];
  const decisionNotes = decisionNotesFor(packet);
  const reviewNeeds = reviewNeedsFor(packet);
  const status = statusFor(blockers, reviewNeeds, decisionNotes);

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_REPOSITORY_REVIEW_PACKET_V1_SCHEMA_VERSION,
    status,
    blockers,
    reviewNeeds,
    decisionNotes,
    recommendedNextBead: nextBeadFor(status),
    boundaryWarnings: [
      'This review packet can open a future persistent static repository implementation bead only after explicit operator and product approval.',
      'It does not add database migrations, production tables, production writes, live prompt-language polling, queues, SSE streams, runtime cards, production actions, or MC connector access.',
      'Declining static persistence keeps runtime ingestion and persistent storage blocked.',
    ],
  });
}

function checkpointBlockers(packet: GslrPersistentStaticRepositoryReviewPacketV1): string[] {
  if (packet.checkpoint.status === 'blocked') {
    return [
      'checkpoint status must not be blocked',
      ...packet.checkpoint.blockers.map((blocker) => `checkpoint blocker: ${blocker}`),
    ];
  }
  return [];
}

function attachmentBlockers(packet: GslrPersistentStaticRepositoryReviewPacketV1): string[] {
  const blockers: string[] = [];
  if (!packet.attachments.staticOperatorReport.attached) {
    blockers.push('staticOperatorReport must be attached');
  }
  if (
    packet.attachments.staticOperatorReport.schemaVersion !==
    'portarium.gslr-static-evidence-workbench-operator-report.v1'
  ) {
    blockers.push('staticOperatorReport schemaVersion must be workbench operator report v1');
  }
  if (packet.attachments.staticOperatorReport.dryRunStatus !== 'accepted') {
    blockers.push('staticOperatorReport dryRunStatus must be accepted');
  }
  if (!packet.attachments.staticOperatorReport.boundaryWarningsIncluded) {
    blockers.push('staticOperatorReport boundary warnings must be included');
  }
  if (!packet.attachments.staticReviewNote.attached) {
    blockers.push('staticReviewNote must be attached');
  }
  if (
    packet.attachments.staticReviewNote.schemaVersion !==
    'portarium.gslr-static-evidence-review-note.v1'
  ) {
    blockers.push('staticReviewNote schemaVersion must be review note v1');
  }
  if (packet.attachments.staticReviewNote.decision !== 'accept_static_evidence_no_runtime') {
    blockers.push('staticReviewNote decision must be accept_static_evidence_no_runtime');
  }
  if (!packet.attachments.staticReviewNote.boundaryWarningIncluded) {
    blockers.push('staticReviewNote boundary warning must be included');
  }
  return blockers;
}

function decisionBlockers(packet: GslrPersistentStaticRepositoryReviewPacketV1): string[] {
  const blockers: string[] = [];
  if (packet.reviewDecision.persistentStorageScope !== 'persistent-static-repository-only') {
    blockers.push('persistentStorageScope must remain persistent-static-repository-only');
  }
  if (!packet.reviewDecision.runtimeIngestionDeferred) {
    blockers.push('runtimeIngestionDeferred must be true');
  }
  return blockers;
}

function implementationBeadBlockers(
  packet: GslrPersistentStaticRepositoryReviewPacketV1,
): string[] {
  const blockers: string[] = [];
  if (!packet.implementationBead.acceptanceCriteriaAttached) {
    blockers.push('implementation acceptance criteria must be attached');
  }
  if (!packet.implementationBead.validationPlanAttached) {
    blockers.push('implementation validation plan must be attached');
  }
  if (!packet.implementationBead.rollbackPlanAttached) {
    blockers.push('implementation rollback plan must be attached');
  }
  if (!packet.implementationBead.noRuntimeBoundaryAttached) {
    blockers.push('implementation no-runtime boundary must be attached');
  }
  return blockers;
}

function reviewNeedsFor(packet: GslrPersistentStaticRepositoryReviewPacketV1): string[] {
  const needs: string[] = [];
  if (packet.reviewDecision.operatorDecision === 'requested') {
    needs.push('operator decision is requested');
  }
  if (packet.reviewDecision.productDecision === 'requested') {
    needs.push('product decision is requested');
  }
  if (!packet.reviewDecision.staticValueConfirmed) {
    needs.push('static persistence value must be confirmed');
  }
  return needs;
}

function decisionNotesFor(packet: GslrPersistentStaticRepositoryReviewPacketV1): string[] {
  const notes: string[] = [];
  if (packet.reviewDecision.operatorDecision === 'decline-static-persistence') {
    notes.push('operator declined static persistence');
  }
  if (packet.reviewDecision.productDecision === 'decline-static-persistence') {
    notes.push('product declined static persistence');
  }
  return notes;
}

function statusFor(
  blockers: readonly string[],
  reviewNeeds: readonly string[],
  decisionNotes: readonly string[],
): GslrPersistentStaticRepositoryReviewPacketStatusV1 {
  if (blockers.length > 0) return 'blocked';
  if (decisionNotes.length > 0) return 'do-not-implement-yet';
  if (reviewNeeds.length > 0) return 'ready-for-static-review';
  return 'ready-to-open-implementation-bead';
}

function nextBeadFor(status: GslrPersistentStaticRepositoryReviewPacketStatusV1): string {
  if (status === 'ready-to-open-implementation-bead') {
    return 'Open a narrow persistent static repository implementation bead.';
  }
  if (status === 'ready-for-static-review') {
    return 'Complete operator and product review on the static-only review packet.';
  }
  if (status === 'do-not-implement-yet') {
    return 'Keep persistent storage blocked and revisit product value later.';
  }
  return 'Clear review packet blockers before implementation work continues.';
}

function assertSchemaVersion(packet: GslrPersistentStaticRepositoryReviewPacketV1) {
  if (packet.schemaVersion !== GSLR_PERSISTENT_STATIC_REPOSITORY_REVIEW_PACKET_V1_SCHEMA_VERSION) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_REPOSITORY_REVIEW_PACKET_V1_SCHEMA_VERSION}`,
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
