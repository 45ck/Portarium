import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

/* cspell:ignore ollama rawpayload */

import { HashSha256 } from '../primitives/index.js';
import type { EvidenceHasher, EvidenceSignatureVerifier } from './evidence-hasher.js';
import {
  canonicalizeGslrEvidenceBundlePayloadV1,
  GSLR_EVIDENCE_BUNDLE_V1_SCHEMA_VERSION,
  GslrEvidenceBundleVerificationError,
  verifyGslrEvidenceBundleV1,
  type GslrEvidenceBundleV1,
} from './gslr-evidence-bundle-v1.js';
import {
  GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION,
  type GslrEngineeringEvidenceCardProjectionInputV1,
} from './gslr-engineering-evidence-card-projection-v1.js';

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

function signedBundle(
  overrides: Partial<GslrEvidenceBundleV1> = {},
  evidenceOverrides: Partial<GslrEngineeringEvidenceCardProjectionInputV1> = {},
): GslrEvidenceBundleV1 {
  const evidence = {
    ...gslr8Evidence(),
    ...evidenceOverrides,
  } satisfies GslrEngineeringEvidenceCardProjectionInputV1;

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

function gslr7Evidence(): GslrEngineeringEvidenceCardProjectionInputV1 {
  return {
    ...gslr8Evidence(),
    route: {
      task: 'gslr7-scaffolded-route-record',
      policyDecision: 'frontier-baseline',
      selectedRun: {
        arm: 'local-only',
        runId: 'gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat',
        runGroupId: 'gslr7-scaffolded-route-record-local-repeats-v2',
        finalVerdict: 'fail',
        privateOracle: 'fail',
        blockingReviewDefects: [
          'accepted oracle command because normalized input was compared with unnormalized constants',
        ],
        frontierTokens: 0,
        cachedInputTokens: 0,
        providerUsd: 0,
        localWallSeconds: 82.961,
        selectedModel: 'qwen3-coder:30b',
        selectedProvider: 'ollama',
        reason:
          'local route-record builder accepted oracle command after comparing normalized input against unnormalized constants',
      },
    },
    artifactRefs: {
      manifest:
        'prompt-language/harness-arena/runs/gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat/manifest.json',
      oracleStdout:
        'prompt-language/harness-arena/runs/gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat/oracle/stdout.txt',
      oracleStderr:
        'prompt-language/harness-arena/runs/gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat/oracle/stderr.txt',
    },
  };
}

describe('verifyGslrEvidenceBundleV1', () => {
  it('verifies a signed GSLR-8 bundle before projecting it to a research-only card', () => {
    const verified = verifyGslrEvidenceBundleV1(signedBundle(), {
      hasher,
      signatureVerifier,
      nowIso: '2026-05-13T01:00:00.000Z',
    });

    expect(verified.card.workItem.id).toBe('gslr8-route-record-compiler');
    expect(verified.card.actionBoundary.status).toBe('research-only');
    expect(verified.card.route.policyDecision).toBe('local-screen');
    expect(verified.card.cost.frontierTokensTotal).toBe(0);
    expect(verified.boundaryWarnings).toContain(
      'Verification does not create live prompt-language ingestion.',
    );
    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(verified.bundle)).toBe(true);
    expect(Object.isFrozen(verified.card)).toBe(true);
  });

  it('verifies a signed GSLR-7 bundle but keeps failed evidence blocked', () => {
    const verified = verifyGslrEvidenceBundleV1(signedBundle({}, gslr7Evidence()), {
      hasher,
      signatureVerifier,
      nowIso: '2026-05-13T01:00:00.000Z',
    });

    expect(verified.card.workItem.id).toBe('gslr7-scaffolded-route-record');
    expect(verified.card.route.policyDecision).toBe('frontier-baseline');
    expect(verified.card.gates.privateOracle).toBe('fail');
    expect(verified.card.actionBoundary.status).toBe('blocked');
  });

  it('rejects tampered payloads before card projection', () => {
    const bundle = signedBundle();
    const tampered = {
      ...bundle,
      evidence: {
        ...bundle.evidence,
        route: {
          ...bundle.evidence.route,
          task: 'gslr8-route-record-compiler-tampered',
        },
      },
      subject: {
        ...bundle.subject,
        task: 'gslr8-route-record-compiler-tampered',
      },
    };

    expect(() =>
      verifyGslrEvidenceBundleV1(tampered, {
        hasher,
        signatureVerifier,
        nowIso: '2026-05-13T01:00:00.000Z',
      }),
    ).toThrow(/payloadHashSha256/);

    expectVerificationError(tampered, 'payload_hash_mismatch', 'payload_hash');
  });

  it('rejects invalid signatures even when the payload hash matches', () => {
    const bundle = {
      ...signedBundle(),
      verification: {
        ...signedBundle().verification,
        signatureBase64: Buffer.from('sig:wrong').toString('base64'),
      },
    };

    expect(() =>
      verifyGslrEvidenceBundleV1(bundle, {
        hasher,
        signatureVerifier,
        nowIso: '2026-05-13T01:00:00.000Z',
      }),
    ).toThrow(/signature verification failed/);

    expectVerificationError(bundle, 'signature_invalid', 'signature');
  });

  it('rejects raw or secret payload fields anywhere in the bundle', () => {
    expect(() =>
      verifyGslrEvidenceBundleV1(
        {
          ...signedBundle(),
          rawPayload: {
            studentName: 'not allowed',
          },
        },
        {
          hasher,
          signatureVerifier,
          nowIso: '2026-05-13T01:00:00.000Z',
        },
      ),
    ).toThrow(GslrEvidenceBundleVerificationError);

    expectVerificationError(
      {
        ...signedBundle(),
        rawPayload: {
          studentName: 'not allowed',
        },
      },
      'raw_payload_forbidden',
      'static_constraints',
    );
  });

  it('rejects missing provenance cross-links', () => {
    expect(() =>
      verifyGslrEvidenceBundleV1(
        signedBundle({
          source: {
            ...signedBundle().source,
            runId: 'different-run',
          },
        }),
        {
          hasher,
          signatureVerifier,
          nowIso: '2026-05-13T01:00:00.000Z',
        },
      ),
    ).toThrow(/source.runId/);

    expectVerificationError(
      signedBundle({
        source: {
          ...signedBundle().source,
          runId: 'different-run',
        },
      }),
      'provenance_mismatch',
      'provenance',
    );
  });

  it('rejects expired bundles as replay-risk evidence', () => {
    expect(() =>
      verifyGslrEvidenceBundleV1(signedBundle(), {
        hasher,
        signatureVerifier,
        nowIso: '2026-05-15T00:00:00.000Z',
      }),
    ).toThrow(/verification window/);

    expectVerificationError(
      signedBundle(),
      'validity_window_invalid',
      'validity_window',
      '2026-05-15T00:00:00.000Z',
    );
  });

  it('rejects invalid explicit verification time', () => {
    expect(() =>
      verifyGslrEvidenceBundleV1(signedBundle(), {
        hasher,
        signatureVerifier,
        nowIso: 'not-an-iso-date',
      }),
    ).toThrow(/nowIso/);
  });

  it('rejects bundles that omit artifact hashes for referenced artifacts', () => {
    const bundle = signedBundle({
      artifactHashes: [
        {
          ref: gslr8Evidence().artifactRefs.manifest,
          sha256: HashSha256('1'.repeat(64)),
        },
      ],
    });
    const canonical = canonicalizeGslrEvidenceBundlePayloadV1(bundle);
    const resigned = {
      ...bundle,
      verification: {
        ...bundle.verification,
        payloadHashSha256: hasher.sha256Hex(canonical),
        signatureBase64: sign(canonical),
      },
    };

    expect(() =>
      verifyGslrEvidenceBundleV1(resigned, {
        hasher,
        signatureVerifier,
        nowIso: '2026-05-13T01:00:00.000Z',
      }),
    ).toThrow(/missing artifact hash/);

    expectVerificationError(resigned, 'artifact_hash_missing', 'artifact_hash_coverage');
  });

  it('rejects bundles that claim runtime authority', () => {
    expect(() =>
      verifyGslrEvidenceBundleV1(
        {
          ...signedBundle(),
          constraints: {
            importMode: 'manual-static-only',
            runtimeAuthority: 'execute',
            actionControls: 'absent',
          },
        },
        {
          hasher,
          signatureVerifier,
          nowIso: '2026-05-13T01:00:00.000Z',
        },
      ),
    ).toThrow(/runtimeAuthority/);
  });
});

function expectVerificationError(
  value: unknown,
  code: GslrEvidenceBundleVerificationError['code'],
  category: GslrEvidenceBundleVerificationError['category'],
  nowIso = '2026-05-13T01:00:00.000Z',
) {
  try {
    verifyGslrEvidenceBundleV1(value, {
      hasher,
      signatureVerifier,
      nowIso,
    });
  } catch (error) {
    expect(error).toBeInstanceOf(GslrEvidenceBundleVerificationError);
    expect((error as GslrEvidenceBundleVerificationError).code).toBe(code);
    expect((error as GslrEvidenceBundleVerificationError).category).toBe(category);
    return;
  }
  throw new Error('Expected GSLR verification to fail');
}
