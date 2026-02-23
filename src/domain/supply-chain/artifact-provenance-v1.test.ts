/**
 * Tests for supply-chain artifact provenance domain model (bead-mlwr).
 *
 * Validates SBOM format guards, signing method guards, release artifact
 * validation, verification policy validation, and policy compliance checks.
 *
 * Bead: bead-mlwr
 */

import { describe, expect, it } from 'vitest';
import {
  isSbomFormat,
  isSigningMethod,
  isAttestationType,
  validateReleaseArtifact,
  validateVerificationPolicy,
  checkArtifactAgainstPolicy,
  type ReleaseArtifact,
  type ArtifactVerificationPolicy,
} from './artifact-provenance-v1.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const VALID_DIGEST = 'sha256:' + 'a'.repeat(64);
const VALID_COMMIT = 'f'.repeat(40);

const compliantArtifact: ReleaseArtifact = {
  component: 'control-plane',
  imageRef: 'ghcr.io/org/portarium-control-plane:v1.0.0',
  digest: VALID_DIGEST,
  sourceCommit: VALID_COMMIT,
  buildWorkflow: '.github/workflows/ci-images.yml',
  sbomFormat: 'spdx-json',
  signingMethod: 'sigstore-keyless',
  attestations: ['slsa-provenance', 'sbom', 'vulnerability-scan'],
  oidcIssuer: 'https://token.actions.githubusercontent.com',
  certificateIdentity:
    'https://github.com/org/repo/.github/workflows/ci-images.yml@refs/heads/main',
};

const strictPolicy: ArtifactVerificationPolicy = {
  requireSignatureVerification: true,
  requireSbomAttestation: true,
  requireProvenanceAttestation: true,
  requireVulnerabilityScan: true,
  expectedOidcIssuer: 'https://token.actions.githubusercontent.com',
  expectedCertificateIdentityPattern: '.*ci-images\\.yml.*',
  maxBuildAgeHours: 72,
};

// ── Type guards ─────────────────────────────────────────────────────────────

describe('isSbomFormat', () => {
  it.each(['spdx-json', 'cyclonedx-json'])('accepts valid format "%s"', (f) => {
    expect(isSbomFormat(f)).toBe(true);
  });

  it.each(['spdx', 'json', '', 'csv'])('rejects invalid format "%s"', (f) => {
    expect(isSbomFormat(f)).toBe(false);
  });
});

describe('isSigningMethod', () => {
  it.each(['sigstore-keyless', 'sigstore-key-pair', 'notation'])('accepts "%s"', (m) => {
    expect(isSigningMethod(m)).toBe(true);
  });

  it.each(['gpg', 'none', ''])('rejects "%s"', (m) => {
    expect(isSigningMethod(m)).toBe(false);
  });
});

describe('isAttestationType', () => {
  it.each(['slsa-provenance', 'sbom', 'vulnerability-scan'])('accepts "%s"', (t) => {
    expect(isAttestationType(t)).toBe(true);
  });

  it.each(['code-review', 'none', ''])('rejects "%s"', (t) => {
    expect(isAttestationType(t)).toBe(false);
  });
});

// ── validateReleaseArtifact ─────────────────────────────────────────────────

describe('validateReleaseArtifact', () => {
  it('accepts a fully compliant artifact', () => {
    expect(validateReleaseArtifact(compliantArtifact)).toEqual({ valid: true });
  });

  it('rejects empty component', () => {
    const result = validateReleaseArtifact({ ...compliantArtifact, component: '' });
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.violations).toContainEqual(expect.stringContaining('component'));
  });

  it('rejects empty imageRef', () => {
    const result = validateReleaseArtifact({ ...compliantArtifact, imageRef: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects digest without sha256: prefix', () => {
    const result = validateReleaseArtifact({ ...compliantArtifact, digest: 'md5:abc' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations).toContainEqual(expect.stringContaining('sha256:'));
  });

  it('rejects truncated digest', () => {
    const result = validateReleaseArtifact({
      ...compliantArtifact,
      digest: 'sha256:abc',
    });
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.violations).toContainEqual(expect.stringContaining('truncated'));
  });

  it('rejects invalid source commit', () => {
    const result = validateReleaseArtifact({
      ...compliantArtifact,
      sourceCommit: 'not-a-sha',
    });
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.violations).toContainEqual(expect.stringContaining('40-character'));
  });

  it('rejects empty build workflow', () => {
    const result = validateReleaseArtifact({ ...compliantArtifact, buildWorkflow: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing slsa-provenance attestation', () => {
    const result = validateReleaseArtifact({
      ...compliantArtifact,
      attestations: ['sbom'],
    });
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.violations).toContainEqual(expect.stringContaining('slsa-provenance'));
  });

  it('rejects missing sbom attestation', () => {
    const result = validateReleaseArtifact({
      ...compliantArtifact,
      attestations: ['slsa-provenance'],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations).toContainEqual(expect.stringContaining('sbom'));
  });

  it('rejects sigstore-keyless without oidcIssuer', () => {
    const result = validateReleaseArtifact({ ...compliantArtifact, oidcIssuer: '' });
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.violations).toContainEqual(expect.stringContaining('oidcIssuer'));
  });

  it('rejects sigstore-keyless without certificateIdentity', () => {
    const result = validateReleaseArtifact({
      ...compliantArtifact,
      certificateIdentity: '',
    });
    expect(result.valid).toBe(false);
  });

  it('collects multiple violations', () => {
    const result = validateReleaseArtifact({
      ...compliantArtifact,
      component: '',
      digest: 'md5:x',
      sourceCommit: 'short',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });
});

// ── validateVerificationPolicy ──────────────────────────────────────────────

describe('validateVerificationPolicy', () => {
  it('accepts a valid strict policy', () => {
    expect(validateVerificationPolicy(strictPolicy)).toEqual({ valid: true });
  });

  it('rejects signature verification without OIDC issuer', () => {
    const result = validateVerificationPolicy({
      ...strictPolicy,
      expectedOidcIssuer: '',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects signature verification without identity pattern', () => {
    const result = validateVerificationPolicy({
      ...strictPolicy,
      expectedCertificateIdentityPattern: '',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid regex in identity pattern', () => {
    const result = validateVerificationPolicy({
      ...strictPolicy,
      expectedCertificateIdentityPattern: '[invalid',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations).toContainEqual(expect.stringContaining('regex'));
  });

  it('rejects maxBuildAgeHours <= 0', () => {
    const result = validateVerificationPolicy({ ...strictPolicy, maxBuildAgeHours: 0 });
    expect(result.valid).toBe(false);
  });

  it('rejects maxBuildAgeHours > 8760', () => {
    const result = validateVerificationPolicy({
      ...strictPolicy,
      maxBuildAgeHours: 9000,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations).toContainEqual(expect.stringContaining('8760'));
  });

  it('accepts permissive policy (no verification required)', () => {
    const permissive: ArtifactVerificationPolicy = {
      requireSignatureVerification: false,
      requireSbomAttestation: false,
      requireProvenanceAttestation: false,
      requireVulnerabilityScan: false,
      expectedOidcIssuer: '',
      expectedCertificateIdentityPattern: '',
      maxBuildAgeHours: 720,
    };
    expect(validateVerificationPolicy(permissive)).toEqual({ valid: true });
  });
});

// ── checkArtifactAgainstPolicy ──────────────────────────────────────────────

describe('checkArtifactAgainstPolicy', () => {
  it('compliant artifact passes strict policy', () => {
    expect(checkArtifactAgainstPolicy(compliantArtifact, strictPolicy)).toEqual({
      valid: true,
    });
  });

  it('rejects artifact with non-Sigstore signing when policy requires it', () => {
    const result = checkArtifactAgainstPolicy(
      { ...compliantArtifact, signingMethod: 'notation' },
      strictPolicy,
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.violations).toContainEqual(expect.stringContaining('Sigstore'));
  });

  it('rejects artifact with wrong OIDC issuer', () => {
    const result = checkArtifactAgainstPolicy(
      { ...compliantArtifact, oidcIssuer: 'https://evil.com' },
      strictPolicy,
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.violations).toContainEqual(expect.stringContaining('OIDC issuer'));
  });

  it('rejects artifact with non-matching certificate identity', () => {
    const result = checkArtifactAgainstPolicy(
      { ...compliantArtifact, certificateIdentity: 'https://evil.com/workflow' },
      strictPolicy,
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.violations).toContainEqual(expect.stringContaining('identity'));
  });

  it('rejects artifact missing SBOM attestation when policy requires it', () => {
    const result = checkArtifactAgainstPolicy(
      { ...compliantArtifact, attestations: ['slsa-provenance', 'vulnerability-scan'] },
      strictPolicy,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations).toContainEqual(expect.stringContaining('SBOM'));
  });

  it('rejects artifact missing provenance when policy requires it', () => {
    const result = checkArtifactAgainstPolicy(
      { ...compliantArtifact, attestations: ['sbom', 'vulnerability-scan'] },
      strictPolicy,
    );
    expect(result.valid).toBe(false);
  });

  it('rejects artifact missing vulnerability scan when policy requires it', () => {
    const result = checkArtifactAgainstPolicy(
      { ...compliantArtifact, attestations: ['slsa-provenance', 'sbom'] },
      strictPolicy,
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.violations).toContainEqual(expect.stringContaining('vulnerability'));
  });

  it('permissive policy accepts any artifact', () => {
    const permissive: ArtifactVerificationPolicy = {
      requireSignatureVerification: false,
      requireSbomAttestation: false,
      requireProvenanceAttestation: false,
      requireVulnerabilityScan: false,
      expectedOidcIssuer: '',
      expectedCertificateIdentityPattern: '',
      maxBuildAgeHours: 720,
    };
    const minimal: ReleaseArtifact = {
      ...compliantArtifact,
      signingMethod: 'notation',
      attestations: ['slsa-provenance', 'sbom'],
    };
    expect(checkArtifactAgainstPolicy(minimal, permissive)).toEqual({ valid: true });
  });
});
