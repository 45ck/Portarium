/* cspell:ignore gslr ollama qwen */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { HashSha256 } from '../primitives/index.js';
import type { EvidenceHasher, EvidenceSignatureVerifier } from './evidence-hasher.js';
import {
  verifyGslrEvidenceBundleV1,
  type GslrEvidenceBundleV1,
} from './gslr-evidence-bundle-v1.js';

const promptLanguageRoot = resolve(process.cwd(), '..', 'prompt-language');
const bundleRefs = [
  'experiments/harness-arena/bundles/gslr-static-evidence-bundles/gslr8-route-record-compiler.bundle.json',
  'experiments/harness-arena/bundles/gslr-static-evidence-bundles/gslr7-scaffolded-route-record.bundle.json',
] as const;
const fixturesAvailable = bundleRefs.every((ref) => existsSync(join(promptLanguageRoot, ref)));
const maybeIt = fixturesAvailable ? it : it.skip;

const hasher: EvidenceHasher = {
  sha256Hex(input: string) {
    return HashSha256(createHash('sha256').update(input, 'utf8').digest('hex'));
  },
};

const signatureVerifier: EvidenceSignatureVerifier = {
  verify(canonical: string, signatureBase64: string) {
    return signatureBase64 === Buffer.from(`sig:${canonical.length}`).toString('base64');
  },
};

function readBundle(ref: string): GslrEvidenceBundleV1 {
  return JSON.parse(readFileSync(join(promptLanguageRoot, ref), 'utf8')) as GslrEvidenceBundleV1;
}

function sha256File(ref: string): string {
  return createHash('sha256')
    .update(readFileSync(join(promptLanguageRoot, ref)))
    .digest('hex');
}

describe('prompt-language GSLR static bundle fixtures', () => {
  maybeIt('verify through the Portarium bundle verifier when sibling fixtures are present', () => {
    const gslr8 = readBundle(bundleRefs[0]);
    const gslr7 = readBundle(bundleRefs[1]);

    for (const bundle of [gslr8, gslr7]) {
      for (const artifact of bundle.artifactHashes) {
        expect(sha256File(artifact.ref)).toBe(artifact.sha256);
      }
    }

    const verifiedGslr8 = verifyGslrEvidenceBundleV1(gslr8, {
      hasher,
      signatureVerifier,
      nowIso: '2026-05-13T02:00:00.000Z',
    });
    const verifiedGslr7 = verifyGslrEvidenceBundleV1(gslr7, {
      hasher,
      signatureVerifier,
      nowIso: '2026-05-13T02:00:00.000Z',
    });

    expect(verifiedGslr8.card.workItem.id).toBe('gslr8-route-record-compiler');
    expect(verifiedGslr8.card.actionBoundary.status).toBe('research-only');
    expect(verifiedGslr8.card.route.policyDecision).toBe('local-screen');
    expect(verifiedGslr8.card.cost.frontierTokensTotal).toBe(0);

    expect(verifiedGslr7.card.workItem.id).toBe('gslr7-scaffolded-route-record');
    expect(verifiedGslr7.card.actionBoundary.status).toBe('blocked');
    expect(verifiedGslr7.card.route.policyDecision).toBe('frontier-baseline');
    expect(verifiedGslr7.card.gates.privateOracle).toBe('fail');
  });
});
