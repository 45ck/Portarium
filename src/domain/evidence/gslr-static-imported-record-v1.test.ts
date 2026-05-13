/* cspell:ignore ollama */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { HashSha256 } from '../primitives/index.js';
import type { EvidenceHasher, EvidenceSignatureVerifier } from './evidence-hasher.js';
import {
  canonicalizeGslrEvidenceBundlePayloadV1,
  GSLR_EVIDENCE_BUNDLE_V1_SCHEMA_VERSION,
  GslrEvidenceBundleVerificationError,
  verifyGslrEvidenceBundleV1,
  type GslrEvidenceBundleV1,
  type VerifiedGslrEvidenceBundleV1,
} from './gslr-evidence-bundle-v1.js';
import {
  GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION,
  type GslrEngineeringEvidenceCardProjectionInputV1,
} from './gslr-engineering-evidence-card-projection-v1.js';
import {
  buildRejectedGslrStaticImportedRecordV1,
  buildVerifiedGslrStaticImportedRecordV1,
  GSLR_STATIC_IMPORTED_RECORD_V1_SCHEMA_VERSION,
} from './gslr-static-imported-record-v1.js';

const hasher: EvidenceHasher = {
  sha256Hex(input: string) {
    return HashSha256(createHash('sha256').update(input, 'utf8').digest('hex'));
  },
};

const signatureVerifier: EvidenceSignatureVerifier = {
  verify(canonical: string, signatureBase64: string) {
    return signatureBase64 === sign(canonical);
  },
};

function sign(canonical: string) {
  return Buffer.from(`sig:${canonical.length}`).toString('base64');
}

function signedBundle(overrides: Partial<GslrEvidenceBundleV1> = {}): GslrEvidenceBundleV1 {
  const evidence = gslr8Evidence();
  const draft = {
    schemaVersion: GSLR_EVIDENCE_BUNDLE_V1_SCHEMA_VERSION,
    bundleId: 'gslr-bundle-gslr8-route-record-compiler-2026-05-13',
    createdAtIso: '2026-05-13T00:30:00.000Z',
    source: {
      system: 'prompt-language',
      repo: '45ck/prompt-language',
      commit: 'a769dd3a769dd3a769dd3a769dd3a769dd3a7',
      runId: evidence.route.selectedRun.runId,
      runGroupId: evidence.route.selectedRun.runGroupId,
    },
    subject: {
      task: evidence.route.task,
      policyVersion: evidence.policyVersion,
    },
    evidence,
    artifactHashes: [
      {
        ref: evidence.artifactRefs.manifest,
        sha256: HashSha256('1'.repeat(64)),
      },
      {
        ref: evidence.artifactRefs.oracleStdout ?? 'private/oracle/stdout.txt',
        sha256: HashSha256('2'.repeat(64)),
      },
      {
        ref: evidence.artifactRefs.oracleStderr ?? 'private/oracle/stderr.txt',
        sha256: HashSha256('3'.repeat(64)),
      },
    ],
    constraints: {
      importMode: 'manual-static-only',
      runtimeAuthority: 'none',
      actionControls: 'absent',
    },
    verification: {
      payloadHashSha256: HashSha256('0'.repeat(64)),
      signatureBase64: 'c2ln',
      signer: {
        keyId: 'gslr-test-key-2026-05-13',
        algorithm: 'test-ed25519',
      },
      notBeforeIso: '2026-05-13T00:00:00.000Z',
      expiresAtIso: '2026-05-14T00:00:00.000Z',
    },
    ...overrides,
  } satisfies GslrEvidenceBundleV1;

  const canonical = canonicalizeGslrEvidenceBundlePayloadV1(draft);
  return {
    ...draft,
    verification: {
      ...draft.verification,
      payloadHashSha256: hasher.sha256Hex(canonical),
      signatureBase64: sign(canonical),
    },
  };
}

function gslr8Evidence(): GslrEngineeringEvidenceCardProjectionInputV1 {
  return {
    schemaVersion: GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION,
    source: {
      manifestSchemaVersion: 2,
    },
    policyVersion: 'gslr-policy-schema-routing-v2',
    route: {
      task: 'gslr8-route-record-compiler',
      policyDecision: 'local-screen',
      selectedRun: {
        arm: 'local-only',
        runId: 'gslr8-route-record-compiler-live-2026-05-13-01-local-diagnostic',
        runGroupId: 'gslr8-route-record-compiler-local-repeats',
        finalVerdict: 'pass',
        privateOracle: 'pass',
        blockingReviewDefects: [],
        frontierTokens: 0,
        cachedInputTokens: 0,
        providerUsd: 0,
        localWallSeconds: 22.175,
        selectedModel: 'qwen3-coder:30b',
        selectedProvider: 'ollama',
        reason:
          'PL-owned scaffold owns route-record policy tables and output envelopes; local model filled predicate hooks',
      },
    },
    artifactRefs: {
      manifest:
        'prompt-language/harness-arena/runs/gslr8-route-record-compiler-live-2026-05-13-01-local-diagnostic/manifest.json',
      oracleStdout:
        'prompt-language/harness-arena/runs/gslr8-route-record-compiler-live-2026-05-13-01-local-diagnostic/oracle/stdout.txt',
      oracleStderr:
        'prompt-language/harness-arena/runs/gslr8-route-record-compiler-live-2026-05-13-01-local-diagnostic/oracle/stderr.txt',
    },
  };
}

function verify(bundle: GslrEvidenceBundleV1): VerifiedGslrEvidenceBundleV1 {
  return verifyGslrEvidenceBundleV1(bundle, {
    hasher,
    signatureVerifier,
    nowIso: '2026-05-13T01:00:00.000Z',
  });
}

describe('GslrStaticImportedRecordV1', () => {
  it('builds an accepted static record from a verified bundle without runtime authority', () => {
    const bundle = signedBundle();
    const record = buildVerifiedGslrStaticImportedRecordV1(verify(bundle), {
      sourceRef: 'fixtures/gslr8-route-record-compiler.bundle.json',
      importedAtIso: '2026-05-13T02:00:00.000Z',
      artifactByteVerificationStatus: 'verified',
    });

    expect(record.schemaVersion).toBe(GSLR_STATIC_IMPORTED_RECORD_V1_SCHEMA_VERSION);
    expect(record.status).toBe('accepted_static');
    expect(record.reviewState).toBe('accepted_static');
    expect(record.bundle.bundleId).toBe(bundle.bundleId);
    expect(record.source.repo).toBe('45ck/prompt-language');
    expect(record.signer.trust).toBe('test-fixture');
    expect(record.verification).toEqual({ status: 'verified', rejection: null });
    expect(record.artifacts).toHaveLength(3);
    expect(
      record.artifacts.every((artifact) => artifact.byteVerificationStatus === 'verified'),
    ).toBe(true);
    expect(record.authority).toEqual({
      runtimeAuthority: 'none',
      actionControls: 'absent',
      liveEndpoints: 'blocked',
      persistence: 'static-record-design-only',
    });
    expect(record.boundaryWarnings.join(' ')).toContain('does not create queues');
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.artifacts)).toBe(true);
  });

  it('builds a quarantined static record from a rejected bundle and preserves code/category', () => {
    const rejectedBundle = {
      ...signedBundle(),
      verification: {
        ...signedBundle().verification,
        signatureBase64: 'c2ln',
      },
    };
    let error: GslrEvidenceBundleVerificationError | null = null;
    try {
      verify(rejectedBundle);
    } catch (caught) {
      error = caught as GslrEvidenceBundleVerificationError;
    }

    expect(error).toBeInstanceOf(GslrEvidenceBundleVerificationError);
    const record = buildRejectedGslrStaticImportedRecordV1(
      { bundle: rejectedBundle, error: error! },
      {
        sourceRef: 'gslr-14-adversarial-corpus/invalid-signature.bundle.json',
        importedAtIso: '2026-05-13T02:00:00.000Z',
      },
    );

    expect(record.status).toBe('quarantined_rejected');
    expect(record.reviewState).toBe('quarantined');
    expect(record.verification.status).toBe('rejected');
    expect(record.verification.rejection).toEqual({
      code: 'signature_invalid',
      category: 'signature',
      message: 'bundle signature verification failed',
    });
    expect(record.artifacts).toHaveLength(3);
    expect(record.authority.runtimeAuthority).toBe('none');
    expect(record.authority.actionControls).toBe('absent');
    expect(record.boundaryWarnings.join(' ')).toContain('quarantined static evidence only');
  });

  it('rejects any verified-record input that claims runtime authority or action controls', () => {
    const verified = verify(signedBundle());
    const unsafeVerified = {
      ...verified,
      bundle: {
        ...verified.bundle,
        constraints: {
          ...verified.bundle.constraints,
          runtimeAuthority: 'execute',
        },
      },
    } as unknown as VerifiedGslrEvidenceBundleV1;

    expect(() =>
      buildVerifiedGslrStaticImportedRecordV1(unsafeVerified, {
        sourceRef: 'unsafe.bundle.json',
        importedAtIso: '2026-05-13T02:00:00.000Z',
      }),
    ).toThrow(/runtime authority/);
  });

  it('requires an explicit import timestamp', () => {
    expect(() =>
      buildVerifiedGslrStaticImportedRecordV1(verify(signedBundle()), {
        sourceRef: 'fixtures/gslr8-route-record-compiler.bundle.json',
        importedAtIso: 'not-a-date',
      }),
    ).toThrow(/importedAtIso/);
  });
});
