/* cspell:ignore gslr */

import { GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES } from './gslr-manual-bundle-preview-fixtures';

export interface GslrManualBundleAdversarialFixture {
  label: string;
  caseId: string;
  sourceRef: string;
  expectedCheckLabel:
    | 'Payload hash'
    | 'Signature'
    | 'Provenance'
    | 'Validity window'
    | 'Artifact hash coverage'
    | 'Static constraints';
  expectedErrorPattern: RegExp;
  bundleJson: string;
}

type BundleRecord = Record<string, unknown>;

const baseFixture = GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES[0];

export const GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES = [
  adversarialFixture({
    label: 'Expired bundle',
    caseId: 'expired-window',
    expectedCheckLabel: 'Validity window',
    expectedErrorPattern: /verification window/i,
    mutate(bundle) {
      verification(bundle)['expiresAtIso'] = '2026-05-13T01:45:00.000Z';
    },
  }),
  adversarialFixture({
    label: 'Not yet valid',
    caseId: 'not-yet-valid-window',
    expectedCheckLabel: 'Validity window',
    expectedErrorPattern: /verification window/i,
    mutate(bundle) {
      bundle['createdAtIso'] = '2026-05-13T03:10:00.000Z';
      verification(bundle)['notBeforeIso'] = '2026-05-13T03:00:00.000Z';
      verification(bundle)['expiresAtIso'] = '2026-05-13T04:00:00.000Z';
    },
  }),
  adversarialFixture({
    label: 'Payload tampered',
    caseId: 'payload-hash-tamper',
    expectedCheckLabel: 'Payload hash',
    expectedErrorPattern: /payloadHashSha256/i,
    mutate(bundle) {
      subject(bundle)['task'] = 'gslr8-route-record-compiler-tampered';
      route(bundle)['task'] = 'gslr8-route-record-compiler-tampered';
    },
  }),
  adversarialFixture({
    label: 'Invalid signature',
    caseId: 'invalid-signature',
    expectedCheckLabel: 'Signature',
    expectedErrorPattern: /signature verification failed/i,
    mutate(bundle) {
      verification(bundle)['signatureBase64'] = 'c2lnOndyb25n';
    },
  }),
  adversarialFixture({
    label: 'Missing artifact hash',
    caseId: 'missing-artifact-hash',
    expectedCheckLabel: 'Artifact hash coverage',
    expectedErrorPattern: /missing artifact hash/i,
    mutate(bundle) {
      const hashes = bundle['artifactHashes'];
      if (!Array.isArray(hashes)) throw new Error('base bundle artifactHashes must be an array');
      bundle['artifactHashes'] = hashes.slice(0, 1);
    },
  }),
  adversarialFixture({
    label: 'Raw payload key',
    caseId: 'raw-payload-key',
    expectedCheckLabel: 'Static constraints',
    expectedErrorPattern: /raw or secret field/i,
    mutate(bundle) {
      bundle['rawPayload'] = { studentName: 'must-not-cross-boundary' };
    },
  }),
  adversarialFixture({
    label: 'Provenance mismatch',
    caseId: 'provenance-mismatch',
    expectedCheckLabel: 'Provenance',
    expectedErrorPattern: /source\.runId/i,
    mutate(bundle) {
      source(bundle)['runId'] = 'gslr8-route-record-compiler-different-run';
    },
  }),
  adversarialFixture({
    label: 'Runtime authority claim',
    caseId: 'runtime-authority-claim',
    expectedCheckLabel: 'Static constraints',
    expectedErrorPattern: /runtimeAuthority/i,
    mutate(bundle) {
      constraints(bundle)['runtimeAuthority'] = 'execute';
    },
  }),
  adversarialFixture({
    label: 'Action controls claim',
    caseId: 'action-controls-claim',
    expectedCheckLabel: 'Static constraints',
    expectedErrorPattern: /actionControls/i,
    mutate(bundle) {
      constraints(bundle)['actionControls'] = 'present';
    },
  }),
] as const satisfies readonly GslrManualBundleAdversarialFixture[];

function adversarialFixture(input: {
  label: string;
  caseId: string;
  expectedCheckLabel: GslrManualBundleAdversarialFixture['expectedCheckLabel'];
  expectedErrorPattern: RegExp;
  mutate: (bundle: BundleRecord) => void;
}): GslrManualBundleAdversarialFixture {
  const bundle = JSON.parse(baseFixture.bundleJson) as BundleRecord;
  input.mutate(bundle);
  return {
    label: input.label,
    caseId: input.caseId,
    expectedCheckLabel: input.expectedCheckLabel,
    expectedErrorPattern: input.expectedErrorPattern,
    sourceRef: `gslr-14-adversarial-corpus/${input.caseId}.bundle.json`,
    bundleJson: JSON.stringify(bundle, null, 2),
  };
}

function source(bundle: BundleRecord) {
  return record(bundle['source'], 'source');
}

function subject(bundle: BundleRecord) {
  return record(bundle['subject'], 'subject');
}

function route(bundle: BundleRecord) {
  return record(record(bundle['evidence'], 'evidence')['route'], 'evidence.route');
}

function constraints(bundle: BundleRecord) {
  return record(bundle['constraints'], 'constraints');
}

function verification(bundle: BundleRecord) {
  return record(bundle['verification'], 'verification');
}

function record(value: unknown, name: string): BundleRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object in the base GSLR bundle fixture`);
  }
  return value as BundleRecord;
}
