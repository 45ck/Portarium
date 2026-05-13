/* cspell:ignore ollama */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { HashSha256 } from '../primitives/index.js';
import type { EvidenceHasher, EvidenceSignatureVerifier } from './evidence-hasher.js';
import {
  canonicalizeGslrEvidenceBundlePayloadV1,
  GSLR_EVIDENCE_BUNDLE_V1_SCHEMA_VERSION,
  type GslrEvidenceBundleV1,
} from './gslr-evidence-bundle-v1.js';
import {
  GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION,
  type GslrEngineeringEvidenceCardProjectionInputV1,
} from './gslr-engineering-evidence-card-projection-v1.js';
import { createGslrStaticImportedRecordRepositoryDesignV1 } from './gslr-static-imported-record-repository-v1.js';
import {
  GSLR_STATIC_IMPORTER_DRY_RUN_V1_SCHEMA_VERSION,
  runGslrStaticImporterDryRunV1,
} from './gslr-static-importer-dry-run-v1.js';

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

function dryRunInput(bundle: unknown, sourceRef: string) {
  return {
    bundle,
    sourceRef,
    nowIso: '2026-05-13T04:30:00.000Z',
    dryRunAtIso: '2026-05-13T05:00:00.000Z',
    actor: 'operator:gslr-20-dry-run',
    hasher,
    signatureVerifier,
  };
}

function signedBundle(
  overrides: {
    evidence?: GslrEngineeringEvidenceCardProjectionInputV1;
    signerAlgorithm?: 'ed25519' | 'test-ed25519';
    signatureBase64?: string;
    constraints?: GslrEvidenceBundleV1['constraints'];
  } = {},
): GslrEvidenceBundleV1 {
  const evidence = overrides.evidence ?? gslr8Evidence();
  const draft = {
    schemaVersion: GSLR_EVIDENCE_BUNDLE_V1_SCHEMA_VERSION,
    bundleId: `gslr-bundle-${evidence.route.task}-2026-05-13`,
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
    constraints: overrides.constraints ?? {
      importMode: 'manual-static-only',
      runtimeAuthority: 'none',
      actionControls: 'absent',
    },
    verification: {
      payloadHashSha256: HashSha256('0'.repeat(64)),
      signatureBase64: 'c2ln',
      signer: {
        keyId:
          overrides.signerAlgorithm === 'test-ed25519'
            ? 'gslr-test-key-2026-05-13'
            : 'gslr-production-key-2026-05-13',
        algorithm: overrides.signerAlgorithm ?? 'ed25519',
      },
      notBeforeIso: '2026-05-13T00:00:00.000Z',
      expiresAtIso: '2026-05-14T00:00:00.000Z',
    },
  } satisfies GslrEvidenceBundleV1;

  const canonical = canonicalizeGslrEvidenceBundlePayloadV1(draft);
  return {
    ...draft,
    verification: {
      ...draft.verification,
      payloadHashSha256: hasher.sha256Hex(canonical),
      signatureBase64: overrides.signatureBase64 ?? sign(canonical),
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
        ...gslr8Evidence().route.selectedRun,
        runId: 'gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat',
        runGroupId: 'gslr7-scaffolded-route-record-local-repeats-v2',
        finalVerdict: 'fail',
        privateOracle: 'fail',
        blockingReviewDefects: ['accepted oracle command key'],
        localWallSeconds: 82.961,
        reason:
          'Local route-record builder still owned too much policy logic and failed the private route-record oracle.',
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

describe('GslrStaticImporterDryRunV1', () => {
  it('stores an accepted append plan for a verified production-trusted GSLR-8 bundle', () => {
    const result = runGslrStaticImporterDryRunV1(
      dryRunInput(
        signedBundle(),
        'fixtures/gslr20/gslr8-route-record-compiler-production-trusted.bundle.json',
      ),
    );

    expect(result.schemaVersion).toBe(GSLR_STATIC_IMPORTER_DRY_RUN_V1_SCHEMA_VERSION);
    expect(result.status).toBe('stored');
    expect(result.verifiedBundle?.card.workItem.id).toBe('gslr8-route-record-compiler');
    expect(result.record.status).toBe('accepted_static');
    expect(result.record.signer.trust).toBe('production-keyring');
    expect(
      result.record.artifacts.every((artifact) => artifact.byteVerificationStatus === 'verified'),
    ).toBe(true);
    expect(result.plan.status).toBe('ready-to-append-static-record');
    expect(result.appendResult?.status).toBe('stored');
    expect(result.appendResult?.auditEvent.eventType).toBe('record_appended');
    expect(result.repositoryEntries).toHaveLength(1);
    expect(result.boundaryWarnings.join(' ')).toContain('does not poll prompt-language manifests');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('replays a repeated accepted dry-run idempotently in the same repository', () => {
    const repository = createGslrStaticImportedRecordRepositoryDesignV1();
    const input = {
      ...dryRunInput(
        signedBundle(),
        'fixtures/gslr20/gslr8-route-record-compiler-production-trusted.bundle.json',
      ),
      repository,
    };

    const first = runGslrStaticImporterDryRunV1(input);
    const second = runGslrStaticImporterDryRunV1(input);

    expect(first.status).toBe('stored');
    expect(second.status).toBe('replayed');
    expect(second.appendResult?.auditEvent.eventType).toBe('idempotent_append_replayed');
    expect(second.repositoryEntries).toHaveLength(1);
  });

  it('quarantines a rejected GSLR-7 bundle with structured failure details', () => {
    const result = runGslrStaticImporterDryRunV1(
      dryRunInput(
        signedBundle({ evidence: gslr7Evidence(), signatureBase64: 'c2ln' }),
        'fixtures/gslr20/gslr7-scaffolded-route-record-invalid-signature.bundle.json',
      ),
    );

    expect(result.status).toBe('stored');
    expect(result.verifiedBundle).toBeNull();
    expect(result.record.status).toBe('quarantined_rejected');
    expect(result.record.reviewState).toBe('quarantined');
    expect(result.record.verification.rejection).toEqual({
      code: 'signature_invalid',
      category: 'signature',
      message: 'bundle signature verification failed',
    });
    expect(result.plan.failureReport).toEqual({
      recordId: result.record.recordId,
      sourceRef: result.record.sourceRef,
      rejectionCode: 'signature_invalid',
      rejectionCategory: 'signature',
      message: 'bundle signature verification failed',
    });
    expect(result.appendResult?.entry.currentReviewState).toBe('quarantined');
  });

  it('blocks accepted fixture imports when production trust or artifact bytes are missing', () => {
    const result = runGslrStaticImporterDryRunV1({
      ...dryRunInput(
        signedBundle({ signerAlgorithm: 'test-ed25519' }),
        'fixtures/gslr20/gslr8-route-record-compiler-test-fixture.bundle.json',
      ),
      verifiedArtifactByteStatus: 'not_fetched',
    });

    expect(result.status).toBe('planned-blocked');
    expect(result.plan.appendInput).toBeNull();
    expect(result.appendResult).toBeNull();
    expect(result.repositoryEntries).toEqual([]);
    expect(result.plan.blockers).toEqual([
      'verified records require production-keyring signer trust before import',
      'verified records require artifact byte verification before import',
    ]);
  });

  it('quarantines static-constraint adversarial bundles instead of granting runtime authority', () => {
    const result = runGslrStaticImporterDryRunV1(
      dryRunInput(
        signedBundle({
          constraints: {
            importMode: 'manual-static-only',
            runtimeAuthority: 'route-decision',
            actionControls: 'absent',
          } as unknown as GslrEvidenceBundleV1['constraints'],
        }),
        'fixtures/gslr20/runtime-authority-claim.bundle.json',
      ),
    );

    expect(result.status).toBe('stored');
    expect(result.record.status).toBe('quarantined_rejected');
    expect(result.record.verification.rejection?.code).toBe('static_constraint_violation');
    expect(result.record.authority.runtimeAuthority).toBe('none');
    expect(result.record.authority.liveEndpoints).toBe('blocked');
    expect(result.plan.status).toBe('ready-to-append-static-record');
    expect(result.appendResult?.entry.authority).toMatchObject({
      runtimeAuthority: 'none',
      actionControls: 'absent',
      liveEndpoints: 'blocked',
      mutationMode: 'append-only-static-records',
    });
  });
});
