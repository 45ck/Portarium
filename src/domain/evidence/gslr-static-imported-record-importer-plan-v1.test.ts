import { describe, expect, it } from 'vitest';

import { HashSha256 } from '../primitives/index.js';
import {
  deriveGslrStaticImportedRecordImporterIdempotencyKeyV1,
  GSLR_STATIC_IMPORTED_RECORD_IMPORTER_PLAN_V1_SCHEMA_VERSION,
  planGslrStaticImportedRecordRepositoryAppendV1,
  strictManualGslrStaticImportedRecordImporterPolicyV1,
  type GslrStaticImportedRecordImporterPolicyV1,
} from './gslr-static-imported-record-importer-plan-v1.js';
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
      keyId: 'gslr-production-key-2026-05-13',
      algorithm: 'ed25519',
      trust: 'production-keyring',
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
    signer: {
      keyId: 'gslr-production-key-2026-05-13',
      algorithm: 'ed25519',
      trust: 'production-keyring',
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

function policy(
  overrides: Partial<GslrStaticImportedRecordImporterPolicyV1> = {},
): GslrStaticImportedRecordImporterPolicyV1 {
  return {
    ...strictManualGslrStaticImportedRecordImporterPolicyV1(),
    ...overrides,
  };
}

describe('GslrStaticImportedRecordImporterPlanV1', () => {
  it('plans a manual accepted-record repository append request', () => {
    const record = acceptedRecord();
    const plan = planGslrStaticImportedRecordRepositoryAppendV1({
      record,
      policy: policy(),
      plannedAtIso: '2026-05-13T04:00:00.000Z',
      actor: 'operator:importer',
    });

    expect(plan.schemaVersion).toBe(GSLR_STATIC_IMPORTED_RECORD_IMPORTER_PLAN_V1_SCHEMA_VERSION);
    expect(plan.status).toBe('ready-to-append-static-record');
    expect(plan.blockers).toEqual([]);
    expect(plan.failureReport).toBeNull();
    expect(plan.idempotencyKey).toBe(
      deriveGslrStaticImportedRecordImporterIdempotencyKeyV1(record),
    );
    expect(plan.appendInput).toEqual({
      record,
      idempotencyKey: plan.idempotencyKey,
      appendedAtIso: '2026-05-13T04:00:00.000Z',
      actor: 'operator:importer',
      reason: 'manual static GSLR import plan for verified bundle',
    });
    expect(plan.boundaryWarnings.join(' ')).toContain('does not fetch artifact bytes');
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it('plans a manual quarantined append request for rejected bundle outcomes', () => {
    const record = rejectedRecord();
    const plan = planGslrStaticImportedRecordRepositoryAppendV1({
      record,
      policy: policy(),
      plannedAtIso: '2026-05-13T04:00:00.000Z',
      actor: 'operator:importer',
    });

    expect(plan.status).toBe('ready-to-append-static-record');
    expect(plan.appendInput?.record.status).toBe('quarantined_rejected');
    expect(plan.appendInput?.record.reviewState).toBe('quarantined');
    expect(plan.failureReport).toEqual({
      recordId: record.recordId,
      sourceRef: record.sourceRef,
      rejectionCode: 'signature_invalid',
      rejectionCategory: 'signature',
      message: 'bundle signature verification failed',
    });
  });

  it('reports readiness blockers instead of producing append input', () => {
    const plan = planGslrStaticImportedRecordRepositoryAppendV1({
      record: acceptedRecord({
        signer: {
          keyId: 'gslr-test-key-2026-05-13',
          algorithm: 'test-ed25519',
          trust: 'test-fixture',
        },
        artifacts: [
          {
            ref: 'prompt-language/harness-arena/runs/gslr8/manifest.json',
            declaredSha256: HashSha256('1'.repeat(64)),
            byteVerificationStatus: 'not_fetched',
            observedSha256: null,
          },
        ],
      }),
      policy: policy({
        artifactBytePolicy: 'declared-hashes-only',
        keyringRequirement: 'test-fixture-allowed',
        failureReporting: 'message-only',
      }),
      plannedAtIso: '2026-05-13T04:00:00.000Z',
      actor: 'operator:importer',
    });

    expect(plan.status).toBe('blocked');
    expect(plan.appendInput).toBeNull();
    expect(plan.blockers).toEqual([
      'artifactBytePolicy must be fetch-and-hash-before-append',
      'keyringRequirement must be production-keyring-required',
      'failureReporting must be structured-rejection-code',
      'verified records require production-keyring signer trust before import',
      'verified records require artifact byte verification before import',
    ]);
  });

  it('rejects live polling, production database, runtime authority, and action controls', () => {
    const plan = planGslrStaticImportedRecordRepositoryAppendV1({
      record: acceptedRecord(),
      policy: policy({
        trigger: 'live-manifest-polling',
        repositoryTarget: 'production-database',
        authority: {
          runtimeAuthority: 'route-decision',
          actionControls: 'present',
          liveEndpoints: 'allowed',
        },
      }),
      plannedAtIso: '2026-05-13T04:00:00.000Z',
      actor: 'operator:importer',
    });

    expect(plan.status).toBe('blocked');
    expect(plan.appendInput).toBeNull();
    expect(plan.blockers).toEqual([
      'import trigger must be manual-operator-submission',
      'repositoryTarget must be append-only-static-record-contract',
      'runtimeAuthority must remain none',
      'actionControls must remain absent',
      'liveEndpoints must remain blocked',
    ]);
  });

  it('rejects imported records that claim live authority', () => {
    const plan = planGslrStaticImportedRecordRepositoryAppendV1({
      record: {
        ...acceptedRecord(),
        authority: {
          runtimeAuthority: 'route-decision',
          actionControls: 'absent',
          liveEndpoints: 'blocked',
          persistence: 'static-record-design-only',
        },
      } as unknown as GslrStaticImportedRecordV1,
      policy: policy(),
      plannedAtIso: '2026-05-13T04:00:00.000Z',
      actor: 'operator:importer',
    });

    expect(plan.status).toBe('blocked');
    expect(plan.blockers).toEqual([
      'record authority must keep runtime authority none and live endpoints blocked',
    ]);
  });
});
