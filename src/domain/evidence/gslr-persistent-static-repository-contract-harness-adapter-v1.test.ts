import { describe, expect, it } from 'vitest';
import { HashSha256 } from '../primitives/index.js';
import {
  evaluateGslrPersistentStaticImportedRecordStorageDesignV1,
  recommendedGslrPersistentStaticImportedRecordStorageDesignV1,
} from './gslr-persistent-static-imported-record-storage-design-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryAdapterContractV1,
  recommendedGslrPersistentStaticRepositoryAdapterContractV1,
} from './gslr-persistent-static-repository-adapter-contract-v1.js';
import {
  createGslrPersistentStaticRepositoryContractHarnessAdapterV1,
  GSLR_PERSISTENT_STATIC_REPOSITORY_CONTRACT_HARNESS_ADAPTER_V1_SCHEMA_VERSION,
} from './gslr-persistent-static-repository-contract-harness-adapter-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryImplementationReadinessV1,
  recommendedGslrPersistentStaticRepositoryImplementationReadinessV1,
} from './gslr-persistent-static-repository-implementation-readiness-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryImplementationV1,
  recommendedGslrPersistentStaticRepositoryImplementationV1,
} from './gslr-persistent-static-repository-implementation-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryReviewPacketV1,
  recommendedGslrPersistentStaticRepositoryReviewPacketV1,
} from './gslr-persistent-static-repository-review-packet-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1,
  recommendedGslrPersistentStaticRepositoryStopReviewCheckpointV1,
} from './gslr-persistent-static-repository-stop-review-checkpoint-v1.js';
import { GslrStaticImportedRecordRepositoryError } from './gslr-static-imported-record-repository-v1.js';
import {
  GSLR_STATIC_IMPORTED_RECORD_V1_SCHEMA_VERSION,
  type GslrStaticImportedRecordV1,
} from './gslr-static-imported-record-v1.js';
import {
  evaluateGslrStaticImportVerificationDesignV1,
  recommendedGslrStaticImportVerificationDesignV1,
} from './gslr-static-import-verification-design-v1.js';

describe('GslrPersistentStaticRepositoryContractHarnessAdapterV1', () => {
  it('exposes only the persistent static repository port with no production writes', () => {
    const adapter = createAdapter();

    expect(adapter.schemaVersion).toBe(
      GSLR_PERSISTENT_STATIC_REPOSITORY_CONTRACT_HARNESS_ADAPTER_V1_SCHEMA_VERSION,
    );
    expect(adapter.metadata).toEqual({
      adapterKind: 'contract-harness-only',
      contractStatus: 'ready-for-adapter-code-review',
      migrationsApplied: false,
      productionTablesCreated: false,
      productionWritesEnabled: false,
      livePromptLanguagePolling: 'blocked',
      queues: 'absent',
      sseStreams: 'absent',
      runtimeCards: 'absent',
      productionActions: 'blocked',
      mcConnectorAccess: 'blocked',
    });
    expect(adapter.boundaryWarnings.join(' ')).toContain('does not apply migrations');

    const exposed = adapter as unknown as Record<string, unknown>;
    expect(exposed['appendStaticImportedRecord']).toBeTypeOf('function');
    expect(exposed['getStaticImportedRecord']).toBeTypeOf('function');
    expect(exposed['listStaticImportedRecords']).toBeTypeOf('function');
    expect(exposed['transitionStaticImportedRecordReviewState']).toBeTypeOf('function');
    expect(exposed['auditTrailForStaticImportedRecord']).toBeTypeOf('function');
    expect(exposed['updateStaticImportedRecord']).toBeUndefined();
    expect(exposed['deleteStaticImportedRecord']).toBeUndefined();
    expect(exposed['pollPromptLanguage']).toBeUndefined();
    expect(exposed['subscribeRuntimeCards']).toBeUndefined();
    expect(exposed['executeAction']).toBeUndefined();
    expect(exposed['readMcConnector']).toBeUndefined();
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it('appends accepted records, replays idempotent writes, and stores canonical fingerprints', () => {
    const adapter = createAdapter();
    const record = acceptedRecord();

    const first = adapter.appendStaticImportedRecord({
      record,
      idempotencyKey: 'source:gslr8:accepted',
      appendedAtIso: '2026-05-13T06:00:00.000Z',
      actor: 'operator:test',
    });
    const replay = adapter.appendStaticImportedRecord({
      record,
      idempotencyKey: 'source:gslr8:accepted',
      appendedAtIso: '2026-05-13T06:01:00.000Z',
      actor: 'operator:test',
    });

    expect(first.status).toBe('stored');
    expect(replay.status).toBe('replayed');
    expect(replay.entry).toBe(first.entry);
    expect(first.entry.recordFingerprint).toContain(
      '"recordId":"gslr-static-import:gslr8:accepted"',
    );
    expect(adapter.getStaticImportedRecord(record.recordId)).toBe(first.entry);
    expect(adapter.listStaticImportedRecords()).toHaveLength(1);
    expect(
      adapter.auditTrailForStaticImportedRecord(record.recordId).map((event) => event.eventType),
    ).toEqual(['record_appended', 'idempotent_append_replayed']);
  });

  it('rejects idempotency conflicts and record ID conflicts', () => {
    const adapter = createAdapter();
    const record = acceptedRecord();
    adapter.appendStaticImportedRecord({
      record,
      idempotencyKey: 'source:gslr8:accepted',
      appendedAtIso: '2026-05-13T06:00:00.000Z',
      actor: 'operator:test',
    });

    expect(() =>
      adapter.appendStaticImportedRecord({
        record: acceptedRecord({ sourceRef: 'fixtures/gslr8-copy.bundle.json' }),
        idempotencyKey: 'source:gslr8:accepted',
        appendedAtIso: '2026-05-13T06:01:00.000Z',
        actor: 'operator:test',
      }),
    ).toThrow(GslrStaticImportedRecordRepositoryError);

    expect(() =>
      adapter.appendStaticImportedRecord({
        record,
        idempotencyKey: 'source:gslr8:accepted-second-key',
        appendedAtIso: '2026-05-13T06:02:00.000Z',
        actor: 'operator:test',
      }),
    ).toThrow(/different idempotencyKey/);
  });

  it('rejects raw payload storage and runtime authority claims', () => {
    const adapter = createAdapter();
    const rawPayloadRecord = {
      ...acceptedRecord(),
      rawPayload: { secret: 'do-not-store' },
    } as unknown as GslrStaticImportedRecordV1;
    const runtimeRecord = {
      ...acceptedRecord({ recordId: 'gslr-static-import:gslr8:runtime-authority' }),
      authority: {
        runtimeAuthority: 'route-decision',
        actionControls: 'absent',
        liveEndpoints: 'blocked',
        persistence: 'static-record-design-only',
      },
    } as unknown as GslrStaticImportedRecordV1;

    expect(() =>
      adapter.appendStaticImportedRecord({
        record: rawPayloadRecord,
        idempotencyKey: 'source:gslr8:raw-payload',
        appendedAtIso: '2026-05-13T06:00:00.000Z',
        actor: 'operator:test',
      }),
    ).toThrow(/raw payload/);
    expect(() =>
      adapter.appendStaticImportedRecord({
        record: runtimeRecord,
        idempotencyKey: 'source:gslr8:runtime-authority',
        appendedAtIso: '2026-05-13T06:01:00.000Z',
        actor: 'operator:test',
      }),
    ).toThrow(/runtime authority/);
  });

  it('enforces constrained review transitions and append-only audit events', () => {
    const adapter = createAdapter();
    const record = rejectedRecord();
    adapter.appendStaticImportedRecord({
      record,
      idempotencyKey: 'source:gslr7:invalid-signature',
      appendedAtIso: '2026-05-13T06:00:00.000Z',
      actor: 'operator:test',
    });

    const pending = adapter.transitionStaticImportedRecordReviewState({
      recordId: record.recordId,
      toReviewState: 'review_pending',
      transitionedAtIso: '2026-05-13T06:05:00.000Z',
      actor: 'operator:reviewer',
      reason: 'inspect rejected bundle',
    });
    const rejected = adapter.transitionStaticImportedRecordReviewState({
      recordId: record.recordId,
      toReviewState: 'rejected',
      transitionedAtIso: '2026-05-13T06:10:00.000Z',
      actor: 'operator:reviewer',
      reason: 'signature still invalid',
    });

    expect(pending.revision).toBe(2);
    expect(rejected.revision).toBe(3);
    expect(
      adapter
        .auditTrailForStaticImportedRecord(record.recordId)
        .map((event) => event.toReviewState),
    ).toEqual(['quarantined', 'review_pending', 'rejected']);
    expect(() =>
      adapter.transitionStaticImportedRecordReviewState({
        recordId: record.recordId,
        toReviewState: 'accepted_static',
        transitionedAtIso: '2026-05-13T06:15:00.000Z',
        actor: 'operator:reviewer',
        reason: 'invalid terminal transition',
      }),
    ).toThrow(/cannot transition/);
    expect(adapter.getStaticImportedRecord('missing-record')).toBeNull();
  });
});

function createAdapter() {
  const verificationGate = evaluateGslrStaticImportVerificationDesignV1(
    recommendedGslrStaticImportVerificationDesignV1(),
  );
  const storageDesign =
    recommendedGslrPersistentStaticImportedRecordStorageDesignV1(verificationGate);
  const storageResult = evaluateGslrPersistentStaticImportedRecordStorageDesignV1(storageDesign);
  expect(storageResult.status).toBe('ready-for-persistent-static-storage-design');
  const readiness = evaluateGslrPersistentStaticRepositoryImplementationReadinessV1(
    recommendedGslrPersistentStaticRepositoryImplementationReadinessV1(storageDesign),
  );
  const checkpoint = evaluateGslrPersistentStaticRepositoryStopReviewCheckpointV1(
    recommendedGslrPersistentStaticRepositoryStopReviewCheckpointV1(readiness),
  );
  const reviewPacket = recommendedGslrPersistentStaticRepositoryReviewPacketV1(checkpoint);
  const approvedReviewPacket = evaluateGslrPersistentStaticRepositoryReviewPacketV1({
    ...reviewPacket,
    reviewDecision: {
      ...reviewPacket.reviewDecision,
      operatorDecision: 'approve-static-persistence',
      productDecision: 'approve-static-persistence',
      staticValueConfirmed: true,
    },
  });
  const implementation = evaluateGslrPersistentStaticRepositoryImplementationV1(
    recommendedGslrPersistentStaticRepositoryImplementationV1(approvedReviewPacket),
  );
  const adapterContract = evaluateGslrPersistentStaticRepositoryAdapterContractV1(
    recommendedGslrPersistentStaticRepositoryAdapterContractV1(implementation),
  );
  expect(adapterContract.status).toBe('ready-for-adapter-code-review');
  return createGslrPersistentStaticRepositoryContractHarnessAdapterV1(adapterContract);
}

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
