import { describe, expect, it } from 'vitest';
import {
  evaluateGslrPersistentStaticImportedRecordStorageDesignV1,
  recommendedGslrPersistentStaticImportedRecordStorageDesignV1,
  type GslrPersistentStaticImportedRecordStorageDesignV1,
} from './gslr-persistent-static-imported-record-storage-design-v1.js';
import {
  evaluateGslrStaticImportVerificationDesignV1,
  recommendedGslrStaticImportVerificationDesignV1,
} from './gslr-static-import-verification-design-v1.js';

describe('GslrPersistentStaticImportedRecordStorageDesignV1', () => {
  it('accepts the recommended persistent static storage design after verification gate readiness', () => {
    const verificationGate = evaluateGslrStaticImportVerificationDesignV1(
      recommendedGslrStaticImportVerificationDesignV1(),
    );
    const design = recommendedGslrPersistentStaticImportedRecordStorageDesignV1(verificationGate);
    const result = evaluateGslrPersistentStaticImportedRecordStorageDesignV1(design);

    expect(result.status).toBe('ready-for-persistent-static-storage-design');
    expect(result.blockers).toEqual([]);
    expect(result.boundaryWarnings.join(' ')).toContain('persistent static storage design only');
    expect(result.boundaryWarnings.join(' ')).toContain('does not create database migrations');
    expect(Object.isFrozen(design)).toBe(true);
    expect(Object.isFrozen(design.storage)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('blocks persistent storage design when keyring or artifact verification gates are not ready', () => {
    const result = evaluateGslrPersistentStaticImportedRecordStorageDesignV1(
      designWith({
        verificationGate: {
          status: 'blocked',
          keyringReady: false,
          artifactBytesReady: false,
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'verificationGate status must be ready-for-static-verification-design',
      'verificationGate keyringReady must be true',
      'verificationGate artifactBytesReady must be true',
    ]);
  });

  it('blocks mutable, overwrite, and last-write-only storage designs', () => {
    const result = evaluateGslrPersistentStaticImportedRecordStorageDesignV1(
      designWith({
        storage: {
          target: 'general-purpose-database',
          mutationModel: 'upsert',
          idempotency: 'optional',
          recordFingerprint: 'none',
          duplicatePolicy: 'overwrite',
          auditTrail: 'last-write-only',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'storage target must be append-only-static-record-store',
      'storage mutationModel must be append-only',
      'storage idempotency must be required',
      'storage recordFingerprint must be canonical-json-sha256',
      'storage duplicatePolicy must reject conflicts and replay identical appends',
      'storage auditTrail must be append-only-events',
    ]);
  });

  it('blocks free-form review, deletion, raw payload storage, and runtime surfaces', () => {
    const result = evaluateGslrPersistentStaticImportedRecordStorageDesignV1(
      designWith({
        review: {
          stateTransitions: 'free-form',
          actorRequired: false,
          reasonRequired: false,
        },
        retention: {
          deletionPolicy: 'allowed',
          exportPermitted: false,
          rawPayloadStorage: 'allowed',
        },
        authority: {
          runtimeAuthority: 'route-decision',
          actionControls: 'present',
          liveEndpoints: 'allowed',
          queues: 'present',
          sseStreams: 'present',
          mcConnectorAccess: 'allowed',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'review stateTransitions must be constrained',
      'review actorRequired must be true',
      'review reasonRequired must be true',
      'retention deletionPolicy must be prohibited',
      'retention exportPermitted must be true for static review packets',
      'retention rawPayloadStorage must be forbidden',
      'runtimeAuthority must remain none',
      'actionControls must remain absent',
      'liveEndpoints must remain blocked',
      'queues must remain absent',
      'sseStreams must remain absent',
      'mcConnectorAccess must remain blocked',
    ]);
  });
});

function designWith(
  overrides: Partial<{
    verificationGate: Partial<
      GslrPersistentStaticImportedRecordStorageDesignV1['verificationGate']
    >;
    storage: Partial<GslrPersistentStaticImportedRecordStorageDesignV1['storage']>;
    review: Partial<GslrPersistentStaticImportedRecordStorageDesignV1['review']>;
    retention: Partial<GslrPersistentStaticImportedRecordStorageDesignV1['retention']>;
    authority: Partial<GslrPersistentStaticImportedRecordStorageDesignV1['authority']>;
  }> = {},
): GslrPersistentStaticImportedRecordStorageDesignV1 {
  const verificationGate = evaluateGslrStaticImportVerificationDesignV1(
    recommendedGslrStaticImportVerificationDesignV1(),
  );
  const design = recommendedGslrPersistentStaticImportedRecordStorageDesignV1(verificationGate);
  return {
    ...design,
    verificationGate: {
      ...design.verificationGate,
      ...overrides.verificationGate,
    },
    storage: {
      ...design.storage,
      ...overrides.storage,
    },
    review: {
      ...design.review,
      ...overrides.review,
    },
    retention: {
      ...design.retention,
      ...overrides.retention,
    },
    authority: {
      ...design.authority,
      ...overrides.authority,
    },
  };
}
