import { canonicalizeJson } from './canonical-json.js';
import type { GslrStaticImportReviewStateV1 } from './gslr-static-import-readiness-v1.js';
import type { GslrStaticImportedRecordV1 } from './gslr-static-imported-record-v1.js';

export const GSLR_STATIC_IMPORTED_RECORD_REPOSITORY_V1_SCHEMA_VERSION =
  'portarium.gslr-static-imported-record-repository.v1' as const;

export type GslrStaticImportedRecordRepositoryAppendStatusV1 = 'stored' | 'replayed';

export type GslrStaticImportedRecordRepositoryAuditEventTypeV1 =
  | 'record_appended'
  | 'idempotent_append_replayed'
  | 'append_rejected'
  | 'review_state_transitioned';

export type GslrStaticImportedRecordRepositoryAuditEventV1 = Readonly<{
  schemaVersion: typeof GSLR_STATIC_IMPORTED_RECORD_REPOSITORY_V1_SCHEMA_VERSION;
  eventId: string;
  eventType: GslrStaticImportedRecordRepositoryAuditEventTypeV1;
  recordId: string;
  occurredAtIso: string;
  actor: string;
  fromReviewState: GslrStaticImportReviewStateV1 | null;
  toReviewState: GslrStaticImportReviewStateV1 | null;
  reason: string | null;
  boundaryWarnings: readonly string[];
}>;

export type GslrStaticImportedRecordRepositoryEntryV1 = Readonly<{
  schemaVersion: typeof GSLR_STATIC_IMPORTED_RECORD_REPOSITORY_V1_SCHEMA_VERSION;
  record: GslrStaticImportedRecordV1;
  recordFingerprint: string;
  idempotencyKey: string;
  appendedAtIso: string;
  currentReviewState: GslrStaticImportReviewStateV1;
  revision: number;
  authority: Readonly<{
    runtimeAuthority: 'none';
    actionControls: 'absent';
    liveEndpoints: 'blocked';
    mutationMode: 'append-only-static-records';
    implementation: 'docs-test-only-in-memory-contract';
  }>;
  boundaryWarnings: readonly string[];
}>;

export type GslrStaticImportedRecordRepositoryAppendInputV1 = Readonly<{
  record: GslrStaticImportedRecordV1;
  idempotencyKey: string;
  appendedAtIso: string;
  actor: string;
  reason?: string;
}>;

export type GslrStaticImportedRecordRepositoryAppendResultV1 = Readonly<{
  status: GslrStaticImportedRecordRepositoryAppendStatusV1;
  entry: GslrStaticImportedRecordRepositoryEntryV1;
  auditEvent: GslrStaticImportedRecordRepositoryAuditEventV1;
}>;

export type GslrStaticImportedRecordRepositoryTransitionInputV1 = Readonly<{
  recordId: string;
  toReviewState: GslrStaticImportReviewStateV1;
  transitionedAtIso: string;
  actor: string;
  reason: string;
}>;

export type GslrStaticImportedRecordRepositoryContractV1 = Readonly<{
  schemaVersion: typeof GSLR_STATIC_IMPORTED_RECORD_REPOSITORY_V1_SCHEMA_VERSION;
  append(
    input: GslrStaticImportedRecordRepositoryAppendInputV1,
  ): GslrStaticImportedRecordRepositoryAppendResultV1;
  get(recordId: string): GslrStaticImportedRecordRepositoryEntryV1 | null;
  list(): readonly GslrStaticImportedRecordRepositoryEntryV1[];
  transitionReviewState(
    input: GslrStaticImportedRecordRepositoryTransitionInputV1,
  ): GslrStaticImportedRecordRepositoryEntryV1;
  auditTrail(recordId: string): readonly GslrStaticImportedRecordRepositoryAuditEventV1[];
  boundaryWarnings: readonly string[];
}>;

export class GslrStaticImportedRecordRepositoryError extends Error {
  public override readonly name = 'GslrStaticImportedRecordRepositoryError';

  public constructor(
    public readonly code:
      | 'idempotency_conflict'
      | 'record_conflict'
      | 'record_not_found'
      | 'invalid_review_transition'
      | 'runtime_authority_forbidden'
      | 'invalid_repository_input',
    message: string,
  ) {
    super(message);
  }
}

export function createGslrStaticImportedRecordRepositoryDesignV1(): GslrStaticImportedRecordRepositoryContractV1 {
  const entriesByRecordId = new Map<string, GslrStaticImportedRecordRepositoryEntryV1>();
  const entriesByIdempotencyKey = new Map<string, GslrStaticImportedRecordRepositoryEntryV1>();
  const auditEvents: GslrStaticImportedRecordRepositoryAuditEventV1[] = [];

  return Object.freeze({
    schemaVersion: GSLR_STATIC_IMPORTED_RECORD_REPOSITORY_V1_SCHEMA_VERSION,
    append(input) {
      assertIso(input.appendedAtIso, 'appendedAtIso');
      assertNonEmpty(input.idempotencyKey, 'idempotencyKey');
      assertNonEmpty(input.actor, 'actor');
      assertRecordAuthority(input.record);

      const fingerprint = canonicalizeJson(input.record);
      const existingForIdempotency = entriesByIdempotencyKey.get(input.idempotencyKey);
      if (existingForIdempotency !== undefined) {
        if (existingForIdempotency.recordFingerprint !== fingerprint) {
          appendAuditEvent(
            auditEvents,
            buildAuditEvent({
              eventType: 'append_rejected',
              recordId: input.record.recordId,
              occurredAtIso: input.appendedAtIso,
              actor: input.actor,
              fromReviewState: null,
              toReviewState: null,
              reason: 'idempotency key was reused with a different record fingerprint',
            }),
          );
          throw new GslrStaticImportedRecordRepositoryError(
            'idempotency_conflict',
            'idempotencyKey already refers to a different static imported record',
          );
        }

        const replayAuditEvent = appendAuditEvent(
          auditEvents,
          buildAuditEvent({
            eventType: 'idempotent_append_replayed',
            recordId: input.record.recordId,
            occurredAtIso: input.appendedAtIso,
            actor: input.actor,
            fromReviewState: existingForIdempotency.currentReviewState,
            toReviewState: existingForIdempotency.currentReviewState,
            reason: input.reason ?? 'idempotent append replay',
          }),
        );

        return Object.freeze({
          status: 'replayed',
          entry: existingForIdempotency,
          auditEvent: replayAuditEvent,
        });
      }

      const existingForRecord = entriesByRecordId.get(input.record.recordId);
      if (existingForRecord !== undefined) {
        appendAuditEvent(
          auditEvents,
          buildAuditEvent({
            eventType: 'append_rejected',
            recordId: input.record.recordId,
            occurredAtIso: input.appendedAtIso,
            actor: input.actor,
            fromReviewState: existingForRecord.currentReviewState,
            toReviewState: null,
            reason: 'record id already exists under a different idempotency key',
          }),
        );
        throw new GslrStaticImportedRecordRepositoryError(
          'record_conflict',
          'recordId already exists under a different idempotencyKey',
        );
      }

      const entry = freezeEntry({
        schemaVersion: GSLR_STATIC_IMPORTED_RECORD_REPOSITORY_V1_SCHEMA_VERSION,
        record: input.record,
        recordFingerprint: fingerprint,
        idempotencyKey: input.idempotencyKey,
        appendedAtIso: input.appendedAtIso,
        currentReviewState: input.record.reviewState,
        revision: 1,
        authority: repositoryAuthority(),
        boundaryWarnings: repositoryBoundaryWarnings(),
      });
      entriesByRecordId.set(entry.record.recordId, entry);
      entriesByIdempotencyKey.set(entry.idempotencyKey, entry);

      const event = appendAuditEvent(
        auditEvents,
        buildAuditEvent({
          eventType: 'record_appended',
          recordId: entry.record.recordId,
          occurredAtIso: input.appendedAtIso,
          actor: input.actor,
          fromReviewState: null,
          toReviewState: entry.currentReviewState,
          reason: input.reason ?? 'static imported record appended',
        }),
      );

      return Object.freeze({
        status: 'stored',
        entry,
        auditEvent: event,
      });
    },
    get(recordId) {
      return entriesByRecordId.get(recordId) ?? null;
    },
    list() {
      return Object.freeze([...entriesByRecordId.values()]);
    },
    transitionReviewState(input) {
      assertIso(input.transitionedAtIso, 'transitionedAtIso');
      assertNonEmpty(input.recordId, 'recordId');
      assertNonEmpty(input.actor, 'actor');
      assertNonEmpty(input.reason, 'reason');

      const existing = entriesByRecordId.get(input.recordId);
      if (existing === undefined) {
        throw new GslrStaticImportedRecordRepositoryError(
          'record_not_found',
          `static imported record ${input.recordId} was not found`,
        );
      }
      if (!canTransition(existing.currentReviewState, input.toReviewState)) {
        throw new GslrStaticImportedRecordRepositoryError(
          'invalid_review_transition',
          `cannot transition GSLR static imported record from ${existing.currentReviewState} to ${input.toReviewState}`,
        );
      }

      const next = freezeEntry({
        ...existing,
        currentReviewState: input.toReviewState,
        revision: existing.revision + 1,
      });
      entriesByRecordId.set(input.recordId, next);
      entriesByIdempotencyKey.set(next.idempotencyKey, next);
      appendAuditEvent(
        auditEvents,
        buildAuditEvent({
          eventType: 'review_state_transitioned',
          recordId: input.recordId,
          occurredAtIso: input.transitionedAtIso,
          actor: input.actor,
          fromReviewState: existing.currentReviewState,
          toReviewState: input.toReviewState,
          reason: input.reason,
        }),
      );
      return next;
    },
    auditTrail(recordId) {
      return Object.freeze(auditEvents.filter((event) => event.recordId === recordId));
    },
    boundaryWarnings: Object.freeze(repositoryBoundaryWarnings()),
  });
}

function repositoryAuthority(): GslrStaticImportedRecordRepositoryEntryV1['authority'] {
  return {
    runtimeAuthority: 'none',
    actionControls: 'absent',
    liveEndpoints: 'blocked',
    mutationMode: 'append-only-static-records',
    implementation: 'docs-test-only-in-memory-contract',
  };
}

function repositoryBoundaryWarnings(): readonly string[] {
  return [
    'Static imported-record repository design is docs/test-only.',
    'Repository design does not create a production database table or live prompt-language ingestion.',
    'Repository design does not create queues, SSE streams, runtime Cockpit cards, route decisions, production actions, or MC connector access.',
  ];
}

function assertRecordAuthority(record: GslrStaticImportedRecordV1) {
  if (
    record.authority.runtimeAuthority !== 'none' ||
    record.authority.actionControls !== 'absent' ||
    record.authority.liveEndpoints !== 'blocked'
  ) {
    throw new GslrStaticImportedRecordRepositoryError(
      'runtime_authority_forbidden',
      'static imported-record repository cannot accept runtime authority, action controls, or live endpoints',
    );
  }
}

function canTransition(
  from: GslrStaticImportReviewStateV1,
  to: GslrStaticImportReviewStateV1,
): boolean {
  if (from === to) return false;
  const allowed: Readonly<
    Record<GslrStaticImportReviewStateV1, readonly GslrStaticImportReviewStateV1[]>
  > = {
    received: ['verified', 'quarantined'],
    verified: ['accepted_static', 'review_pending'],
    quarantined: ['review_pending', 'rejected'],
    review_pending: ['accepted_static', 'rejected'],
    accepted_static: ['superseded'],
    rejected: ['superseded'],
    superseded: [],
  };
  return allowed[from].includes(to);
}

function buildAuditEvent(input: {
  eventType: GslrStaticImportedRecordRepositoryAuditEventTypeV1;
  recordId: string;
  occurredAtIso: string;
  actor: string;
  fromReviewState: GslrStaticImportReviewStateV1 | null;
  toReviewState: GslrStaticImportReviewStateV1 | null;
  reason: string | null;
}): GslrStaticImportedRecordRepositoryAuditEventV1 {
  return deepFreeze({
    schemaVersion: GSLR_STATIC_IMPORTED_RECORD_REPOSITORY_V1_SCHEMA_VERSION,
    eventId: `gslr-static-import-repository:${input.recordId}:${input.eventType}:${input.occurredAtIso}`,
    eventType: input.eventType,
    recordId: input.recordId,
    occurredAtIso: input.occurredAtIso,
    actor: input.actor,
    fromReviewState: input.fromReviewState,
    toReviewState: input.toReviewState,
    reason: input.reason,
    boundaryWarnings: repositoryBoundaryWarnings(),
  });
}

function appendAuditEvent(
  auditEvents: GslrStaticImportedRecordRepositoryAuditEventV1[],
  event: GslrStaticImportedRecordRepositoryAuditEventV1,
) {
  auditEvents.push(event);
  return event;
}

function freezeEntry(
  entry: GslrStaticImportedRecordRepositoryEntryV1,
): GslrStaticImportedRecordRepositoryEntryV1 {
  return deepFreeze(entry);
}

function assertNonEmpty(value: string, name: string) {
  if (value.length === 0) {
    throw new GslrStaticImportedRecordRepositoryError(
      'invalid_repository_input',
      `${name} must be non-empty`,
    );
  }
}

function assertIso(value: string, name: string) {
  if (Number.isNaN(Date.parse(value))) {
    throw new GslrStaticImportedRecordRepositoryError(
      'invalid_repository_input',
      `${name} must be a valid ISO date`,
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
