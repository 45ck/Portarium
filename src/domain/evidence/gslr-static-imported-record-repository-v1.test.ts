import { describe, expect, it } from 'vitest';

import { HashSha256 } from '../primitives/index.js';
import {
  createGslrStaticImportedRecordRepositoryDesignV1,
  GslrStaticImportedRecordRepositoryError,
  GSLR_STATIC_IMPORTED_RECORD_REPOSITORY_V1_SCHEMA_VERSION,
} from './gslr-static-imported-record-repository-v1.js';
import {
  GSLR_STATIC_IMPORTED_RECORD_V1_SCHEMA_VERSION,
  type GslrStaticImportedRecordV1,
} from './gslr-static-imported-record-v1.js';

function acceptedRecord(overrides: Partial<GslrStaticImportedRecordV1> = {}) {
  return {
    schemaVersion: GSLR_STATIC_IMPORTED_RECORD_V1_SCHEMA_VERSION,
    recordId: 'gslr-static-import:gslr8:accepted',
    sourceRef: 'fixtures/gslr8-route-record-compiler.bundle.json',
    importedAtIso: '2026-05-13T02:00:00.000Z',
    status: 'accepted_static',
    reviewState: 'accepted_static',
    bundle: {
      bundleId: 'gslr-bundle-gslr8-route-record-compiler-2026-05-13',
      payloadHashSha256: HashSha256('0'.repeat(64)),
      createdAtIso: '2026-05-13T00:30:00.000Z',
    },
    source: {
      system: 'prompt-language',
      repo: '45ck/prompt-language',
      commit: 'a769dd3a769dd3a769dd3a769dd3a769dd3a7',
      runId: 'gslr8-route-record-compiler-live-2026-05-13-01-local-diagnostic',
      runGroupId: 'gslr8-route-record-compiler-local-repeats',
    },
    subject: {
      task: 'gslr8-route-record-compiler',
      policyVersion: 'gslr-policy-schema-routing-v2',
    },
    signer: {
      keyId: 'gslr-test-key-2026-05-13',
      algorithm: 'test-ed25519',
      trust: 'test-fixture',
    },
    verification: {
      status: 'verified',
      rejection: null,
    },
    artifacts: [
      {
        ref: 'prompt-language/harness-arena/runs/gslr8/manifest.json',
        declaredSha256: HashSha256('1'.repeat(64)),
        byteVerificationStatus: 'verified',
        observedSha256: HashSha256('1'.repeat(64)),
      },
    ],
    authority: {
      runtimeAuthority: 'none',
      actionControls: 'absent',
      liveEndpoints: 'blocked',
      persistence: 'static-record-design-only',
    },
    boundaryWarnings: ['Static imported record design does not persist to a database.'],
    ...overrides,
  } satisfies GslrStaticImportedRecordV1;
}

function rejectedRecord(overrides: Partial<GslrStaticImportedRecordV1> = {}) {
  return acceptedRecord({
    recordId: 'gslr-static-import:gslr7:signature_invalid',
    sourceRef: 'gslr-14-adversarial-corpus/invalid-signature.bundle.json',
    status: 'quarantined_rejected',
    reviewState: 'quarantined',
    bundle: {
      bundleId: 'gslr-bundle-gslr7-scaffolded-route-record-2026-05-13',
      payloadHashSha256: HashSha256('2'.repeat(64)),
      createdAtIso: '2026-05-13T00:30:00.000Z',
    },
    subject: {
      task: 'gslr7-scaffolded-route-record',
      policyVersion: 'gslr-policy-schema-routing-v2',
    },
    verification: {
      status: 'rejected',
      rejection: {
        code: 'signature_invalid',
        category: 'signature',
        message: 'bundle signature verification failed',
      },
    },
    artifacts: [
      {
        ref: 'prompt-language/harness-arena/runs/gslr7/manifest.json',
        declaredSha256: HashSha256('3'.repeat(64)),
        byteVerificationStatus: 'not_fetched',
        observedSha256: null,
      },
    ],
    boundaryWarnings: ['Rejected GSLR bundle is quarantined static evidence only.'],
    ...overrides,
  });
}

describe('GslrStaticImportedRecordRepositoryV1', () => {
  it('stores accepted static records idempotently without runtime authority', () => {
    const repository = createGslrStaticImportedRecordRepositoryDesignV1();
    const record = acceptedRecord();

    const first = repository.append({
      record,
      idempotencyKey: 'source:gslr8:accepted',
      appendedAtIso: '2026-05-13T03:00:00.000Z',
      actor: 'operator:test',
    });
    const replay = repository.append({
      record,
      idempotencyKey: 'source:gslr8:accepted',
      appendedAtIso: '2026-05-13T03:01:00.000Z',
      actor: 'operator:test',
    });

    expect(repository.schemaVersion).toBe(GSLR_STATIC_IMPORTED_RECORD_REPOSITORY_V1_SCHEMA_VERSION);
    expect(first.status).toBe('stored');
    expect(replay.status).toBe('replayed');
    expect(replay.entry).toBe(first.entry);
    expect(repository.list()).toHaveLength(1);
    expect(first.entry.authority).toEqual({
      runtimeAuthority: 'none',
      actionControls: 'absent',
      liveEndpoints: 'blocked',
      mutationMode: 'append-only-static-records',
      implementation: 'docs-test-only-in-memory-contract',
    });
    expect(first.entry.currentReviewState).toBe('accepted_static');
    expect(repository.auditTrail(record.recordId).map((event) => event.eventType)).toEqual([
      'record_appended',
      'idempotent_append_replayed',
    ]);
    expect(Object.isFrozen(first.entry)).toBe(true);
  });

  it('rejects conflicting duplicate writes instead of overwriting records', () => {
    const repository = createGslrStaticImportedRecordRepositoryDesignV1();
    const record = acceptedRecord();
    repository.append({
      record,
      idempotencyKey: 'source:gslr8:accepted',
      appendedAtIso: '2026-05-13T03:00:00.000Z',
      actor: 'operator:test',
    });

    expect(() =>
      repository.append({
        record: acceptedRecord({
          sourceRef: 'fixtures/gslr8-route-record-compiler-copy.bundle.json',
        }),
        idempotencyKey: 'source:gslr8:accepted',
        appendedAtIso: '2026-05-13T03:01:00.000Z',
        actor: 'operator:test',
      }),
    ).toThrow(GslrStaticImportedRecordRepositoryError);

    expect(() =>
      repository.append({
        record,
        idempotencyKey: 'source:gslr8:accepted-second-key',
        appendedAtIso: '2026-05-13T03:02:00.000Z',
        actor: 'operator:test',
      }),
    ).toThrow(/different idempotencyKey/);
    expect(repository.get(record.recordId)?.revision).toBe(1);
    expect(repository.list()).toHaveLength(1);
  });

  it('constrains review-state transitions through append-only revisions', () => {
    const repository = createGslrStaticImportedRecordRepositoryDesignV1();
    const record = rejectedRecord();
    const first = repository.append({
      record,
      idempotencyKey: 'source:gslr7:invalid-signature',
      appendedAtIso: '2026-05-13T03:00:00.000Z',
      actor: 'operator:test',
    });

    const reviewPending = repository.transitionReviewState({
      recordId: record.recordId,
      toReviewState: 'review_pending',
      transitionedAtIso: '2026-05-13T03:05:00.000Z',
      actor: 'operator:reviewer',
      reason: 'operator inspected quarantined rejection',
    });
    const rejected = repository.transitionReviewState({
      recordId: record.recordId,
      toReviewState: 'rejected',
      transitionedAtIso: '2026-05-13T03:10:00.000Z',
      actor: 'operator:reviewer',
      reason: 'signature failure remains blocking',
    });

    expect(first.entry.revision).toBe(1);
    expect(reviewPending.revision).toBe(2);
    expect(rejected.revision).toBe(3);
    expect(repository.get(record.recordId)?.currentReviewState).toBe('rejected');
    expect(repository.auditTrail(record.recordId).map((event) => event.toReviewState)).toEqual([
      'quarantined',
      'review_pending',
      'rejected',
    ]);
    expect(() =>
      repository.transitionReviewState({
        recordId: record.recordId,
        toReviewState: 'accepted_static',
        transitionedAtIso: '2026-05-13T03:15:00.000Z',
        actor: 'operator:reviewer',
        reason: 'invalid terminal transition',
      }),
    ).toThrow(/cannot transition/);
  });

  it('has no runtime, update, delete, queue, or subscription operations', () => {
    const repository = createGslrStaticImportedRecordRepositoryDesignV1() as unknown as Record<
      string,
      unknown
    >;

    expect(repository['append']).toBeTypeOf('function');
    expect(repository['get']).toBeTypeOf('function');
    expect(repository['list']).toBeTypeOf('function');
    expect(repository['transitionReviewState']).toBeTypeOf('function');
    expect(repository['auditTrail']).toBeTypeOf('function');
    expect(repository['update']).toBeUndefined();
    expect(repository['delete']).toBeUndefined();
    expect(repository['enqueue']).toBeUndefined();
    expect(repository['subscribe']).toBeUndefined();
    expect(repository['execute']).toBeUndefined();
    expect(repository['stream']).toBeUndefined();
  });

  it('rejects imported records that claim live authority', () => {
    const repository = createGslrStaticImportedRecordRepositoryDesignV1();
    const unsafe = {
      ...acceptedRecord(),
      authority: {
        runtimeAuthority: 'route-decision',
        actionControls: 'absent',
        liveEndpoints: 'blocked',
        persistence: 'static-record-design-only',
      },
    } as unknown as GslrStaticImportedRecordV1;

    expect(() =>
      repository.append({
        record: unsafe,
        idempotencyKey: 'source:unsafe',
        appendedAtIso: '2026-05-13T03:00:00.000Z',
        actor: 'operator:test',
      }),
    ).toThrow(/runtime authority/);
  });
});
