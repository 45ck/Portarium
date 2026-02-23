/**
 * Supply-chain artifact provenance domain model (bead-mlwr).
 *
 * Defines the types and validation rules for SBOM, container image signing,
 * and SLSA provenance attestations.  These domain types model the properties
 * of release artifacts that must be verifiable before deployment.
 *
 * Bead: bead-mlwr
 * ADR: ADR-0109 (SBOM Generation + Artifact Signing + Provenance Attestations)
 */

// ---------------------------------------------------------------------------
// SBOM format
// ---------------------------------------------------------------------------

const SBOM_FORMATS = ['spdx-json', 'cyclonedx-json'] as const;

export type SbomFormat = (typeof SBOM_FORMATS)[number];

export function isSbomFormat(value: string): value is SbomFormat {
  return (SBOM_FORMATS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Signing method
// ---------------------------------------------------------------------------

const SIGNING_METHODS = ['sigstore-keyless', 'sigstore-key-pair', 'notation'] as const;

export type SigningMethod = (typeof SIGNING_METHODS)[number];

export function isSigningMethod(value: string): value is SigningMethod {
  return (SIGNING_METHODS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Attestation type
// ---------------------------------------------------------------------------

const ATTESTATION_TYPES = ['slsa-provenance', 'sbom', 'vulnerability-scan'] as const;

export type AttestationType = (typeof ATTESTATION_TYPES)[number];

export function isAttestationType(value: string): value is AttestationType {
  return (ATTESTATION_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Release artifact
// ---------------------------------------------------------------------------

/**
 * A release artifact with its supply-chain integrity metadata.
 */
export type ReleaseArtifact = Readonly<{
  /** Component name (e.g., 'control-plane', 'worker'). */
  component: string;
  /** OCI image reference (registry/repo:tag). */
  imageRef: string;
  /** Image digest (sha256:...). */
  digest: string;
  /** Git commit SHA that produced this artifact. */
  sourceCommit: string;
  /** CI workflow that built the artifact. */
  buildWorkflow: string;
  /** SBOM format used. */
  sbomFormat: SbomFormat;
  /** Signing method used. */
  signingMethod: SigningMethod;
  /** Attestation types attached to this artifact. */
  attestations: readonly AttestationType[];
  /** Expected OIDC issuer for signature verification. */
  oidcIssuer: string;
  /** Expected certificate identity (workflow ref). */
  certificateIdentity: string;
}>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ArtifactValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly violations: readonly string[] };

/**
 * Validate that a release artifact has all required supply-chain metadata.
 */
export function validateReleaseArtifact(artifact: ReleaseArtifact): ArtifactValidationResult {
  const violations: string[] = [];

  if (!artifact.component.trim()) {
    violations.push('component must be non-empty.');
  }

  if (!artifact.imageRef.trim()) {
    violations.push('imageRef must be non-empty.');
  }

  // Digest must be sha256
  if (!artifact.digest.startsWith('sha256:')) {
    violations.push(`digest must start with 'sha256:', got '${artifact.digest}'.`);
  }

  if (artifact.digest.length < 71) {
    // sha256: (7) + 64 hex chars = 71
    violations.push('digest appears truncated (expected sha256: + 64 hex characters).');
  }

  // Source commit must be a 40-char hex string
  if (!/^[0-9a-f]{40}$/i.test(artifact.sourceCommit)) {
    violations.push('sourceCommit must be a 40-character hex SHA.');
  }

  if (!artifact.buildWorkflow.trim()) {
    violations.push('buildWorkflow must be non-empty.');
  }

  // Must have at least SLSA provenance and SBOM attestations
  if (!artifact.attestations.includes('slsa-provenance')) {
    violations.push("attestations must include 'slsa-provenance'.");
  }

  if (!artifact.attestations.includes('sbom')) {
    violations.push("attestations must include 'sbom'.");
  }

  // OIDC issuer must be set for keyless signing
  if (artifact.signingMethod === 'sigstore-keyless' && !artifact.oidcIssuer.trim()) {
    violations.push('oidcIssuer is required for sigstore-keyless signing.');
  }

  if (artifact.signingMethod === 'sigstore-keyless' && !artifact.certificateIdentity.trim()) {
    violations.push('certificateIdentity is required for sigstore-keyless signing.');
  }

  if (violations.length === 0) return { valid: true };
  return { valid: false, violations };
}

// ---------------------------------------------------------------------------
// Verification policy
// ---------------------------------------------------------------------------

/**
 * Policy governing how artifacts are verified before deployment.
 */
export type ArtifactVerificationPolicy = Readonly<{
  /** Require Sigstore keyless signature verification. */
  requireSignatureVerification: boolean;
  /** Require SBOM attestation to be present and verified. */
  requireSbomAttestation: boolean;
  /** Require SLSA provenance attestation. */
  requireProvenanceAttestation: boolean;
  /** Require vulnerability scan with no CRITICAL/HIGH findings. */
  requireVulnerabilityScan: boolean;
  /** Expected OIDC issuer for certificate verification. */
  expectedOidcIssuer: string;
  /** Expected certificate identity pattern (regex). */
  expectedCertificateIdentityPattern: string;
  /** Maximum age of the build (in hours) for freshness check. */
  maxBuildAgeHours: number;
}>;

/**
 * Validate that a verification policy is internally consistent.
 */
export function validateVerificationPolicy(
  policy: ArtifactVerificationPolicy,
): ArtifactValidationResult {
  const violations: string[] = [];

  if (policy.requireSignatureVerification && !policy.expectedOidcIssuer.trim()) {
    violations.push('expectedOidcIssuer is required when signature verification is enabled.');
  }

  if (policy.requireSignatureVerification && !policy.expectedCertificateIdentityPattern.trim()) {
    violations.push(
      'expectedCertificateIdentityPattern is required when signature verification is enabled.',
    );
  }

  // Validate the identity pattern is a valid regex
  if (policy.expectedCertificateIdentityPattern.trim()) {
    try {
      new RegExp(policy.expectedCertificateIdentityPattern);
    } catch {
      violations.push(
        `expectedCertificateIdentityPattern is not a valid regex: '${policy.expectedCertificateIdentityPattern}'.`,
      );
    }
  }

  if (policy.maxBuildAgeHours <= 0) {
    violations.push('maxBuildAgeHours must be positive.');
  }

  if (policy.maxBuildAgeHours > 8760) {
    // 1 year
    violations.push('maxBuildAgeHours exceeds maximum of 8760 (1 year).');
  }

  if (violations.length === 0) return { valid: true };
  return { valid: false, violations };
}

/**
 * Check whether an artifact satisfies a verification policy.
 */
export function checkArtifactAgainstPolicy(
  artifact: ReleaseArtifact,
  policy: ArtifactVerificationPolicy,
): ArtifactValidationResult {
  const violations: string[] = [];

  if (policy.requireSignatureVerification) {
    if (
      artifact.signingMethod !== 'sigstore-keyless' &&
      artifact.signingMethod !== 'sigstore-key-pair'
    ) {
      violations.push(
        `Policy requires Sigstore signing, but artifact uses '${artifact.signingMethod}'.`,
      );
    }

    if (artifact.oidcIssuer !== policy.expectedOidcIssuer) {
      violations.push(
        `OIDC issuer mismatch: expected '${policy.expectedOidcIssuer}', ` +
          `got '${artifact.oidcIssuer}'.`,
      );
    }

    if (policy.expectedCertificateIdentityPattern) {
      const re = new RegExp(policy.expectedCertificateIdentityPattern);
      if (!re.test(artifact.certificateIdentity)) {
        violations.push(
          `Certificate identity '${artifact.certificateIdentity}' does not match ` +
            `expected pattern '${policy.expectedCertificateIdentityPattern}'.`,
        );
      }
    }
  }

  if (policy.requireSbomAttestation && !artifact.attestations.includes('sbom')) {
    violations.push('Policy requires SBOM attestation, but artifact does not have one.');
  }

  if (policy.requireProvenanceAttestation && !artifact.attestations.includes('slsa-provenance')) {
    violations.push('Policy requires SLSA provenance attestation, but artifact does not have one.');
  }

  if (policy.requireVulnerabilityScan && !artifact.attestations.includes('vulnerability-scan')) {
    violations.push(
      'Policy requires vulnerability scan attestation, but artifact does not have one.',
    );
  }

  if (violations.length === 0) return { valid: true };
  return { valid: false, violations };
}
