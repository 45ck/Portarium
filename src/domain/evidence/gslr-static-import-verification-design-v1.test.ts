import { describe, expect, it } from 'vitest';
import {
  evaluateGslrStaticImportVerificationDesignV1,
  recommendedGslrStaticImportVerificationDesignV1,
  type GslrStaticImportVerificationDesignV1,
} from './gslr-static-import-verification-design-v1.js';

describe('GslrStaticImportVerificationDesignV1', () => {
  it('accepts the recommended static verification design split', () => {
    const design = recommendedGslrStaticImportVerificationDesignV1();
    const result = evaluateGslrStaticImportVerificationDesignV1(design);

    expect(result.status).toBe('ready-for-static-verification-design');
    expect(result.keyringReady).toBe(true);
    expect(result.artifactBytesReady).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.boundaryWarnings.join(' ')).toContain('static verification design only');
    expect(result.boundaryWarnings.join(' ')).toContain('live source fetch remains blocked');
    expect(Object.isFrozen(design)).toBe(true);
    expect(Object.isFrozen(design.keyring)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.boundaryWarnings)).toBe(true);
  });

  it('blocks test fixtures, network-discovered keyrings, and missing key lifecycle policies', () => {
    const result = evaluateGslrStaticImportVerificationDesignV1(
      designWith({
        keyring: {
          trustSource: 'test-fixture',
          trustStoreMode: 'network-discovered',
          trustedAlgorithms: ['test-ed25519'],
          revocationPolicy: 'absent',
          rotationPolicy: 'absent',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.keyringReady).toBe(false);
    expect(result.artifactBytesReady).toBe(true);
    expect(result.blockers).toEqual([
      'keyring trustSource must be production-keyring',
      'keyring trustStoreMode must be pinned-static, not network-discovered',
      'keyring trustedAlgorithms must include ed25519 and exclude test-ed25519',
      'keyring revocationPolicy must be documented',
      'keyring rotationPolicy must be documented',
    ]);
  });

  it('blocks declared-hash-only and live-source artifact byte designs', () => {
    const declaredOnly = evaluateGslrStaticImportVerificationDesignV1(
      designWith({
        artifacts: {
          byteSource: 'declared-hashes-only',
          hashAlgorithm: 'none',
          missingBytePolicy: 'allow-not-fetched',
          mismatchPolicy: 'allow',
          rawPayloadPolicy: 'allow',
          maxBytesPerArtifact: 0,
        },
      }),
    );

    expect(declaredOnly.artifactBytesReady).toBe(false);
    expect(declaredOnly.blockers).toContain('artifact byteSource must be operator-supplied-bytes');
    expect(declaredOnly.blockers).toContain('artifact hashAlgorithm must be sha256');
    expect(declaredOnly.blockers).toContain('artifact missingBytePolicy must block missing bytes');
    expect(declaredOnly.blockers).toContain('artifact mismatchPolicy must quarantine mismatches');
    expect(declaredOnly.blockers).toContain(
      'artifact rawPayloadPolicy must reject raw/source payload bodies',
    );
    expect(declaredOnly.blockers).toContain(
      'artifact maxBytesPerArtifact must be a positive integer',
    );

    const liveFetch = evaluateGslrStaticImportVerificationDesignV1(
      designWith({ artifacts: { byteSource: 'live-source-fetch' } }),
    );

    expect(liveFetch.status).toBe('blocked');
    expect(liveFetch.blockers).toContain('artifact byteSource must be operator-supplied-bytes');
  });

  it('blocks runtime authority, actions, live endpoints, and MC connector access', () => {
    const result = evaluateGslrStaticImportVerificationDesignV1(
      designWith({
        authority: {
          runtimeAuthority: 'route-decision',
          actionControls: 'present',
          liveEndpoints: 'allowed',
          mcConnectorAccess: 'allowed',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'runtimeAuthority must remain none',
      'actionControls must remain absent',
      'liveEndpoints must remain blocked',
      'mcConnectorAccess must remain blocked',
    ]);
  });
});

function designWith(
  overrides: Partial<{
    keyring: Partial<GslrStaticImportVerificationDesignV1['keyring']>;
    artifacts: Partial<GslrStaticImportVerificationDesignV1['artifacts']>;
    authority: Partial<GslrStaticImportVerificationDesignV1['authority']>;
  }> = {},
): GslrStaticImportVerificationDesignV1 {
  const design = recommendedGslrStaticImportVerificationDesignV1();
  return {
    ...design,
    keyring: {
      ...design.keyring,
      ...overrides.keyring,
    },
    artifacts: {
      ...design.artifacts,
      ...overrides.artifacts,
    },
    authority: {
      ...design.authority,
      ...overrides.authority,
    },
  };
}
