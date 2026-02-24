# ADR-0113: SBOM Generation + Artifact Signing + Provenance Attestations

- **Status**: Accepted
- **Date**: 2026-02-23
- **Bead**: bead-mlwr
- **Deciders**: Platform Security Team

## Context

SLSA Build Level 2 requires that every release artifact has cryptographic
provenance and integrity guarantees. Without SBOM generation, image signing,
and provenance attestations, "supply-chain security" is aspirational rather
than verifiable.

Portarium publishes two container images (control-plane, worker) to GHCR.
Consumers need to verify:

1. **Who built it** -- the GitHub Actions workflow, not a compromised laptop.
2. **What source** -- the exact git commit.
3. **What dependencies** -- the SBOM listing all packages.
4. **That it hasn't been tampered with** -- cryptographic signature.

## Decision

### SBOM generation

- **Format**: SPDX JSON (industry standard, GitHub dependency graph compatible).
- **Tool**: Anchore Syft via `anchore/sbom-action` (already integrated).
- **Scope**: Each container image gets its own SBOM.
- **Storage**: Pushed as a cosign attestation referrer to the OCI registry.

### Container image signing

- **Method**: Sigstore keyless signing via `cosign sign --yes`.
- **Identity**: GitHub Actions OIDC token (Fulcio CA + Rekor transparency log).
- **No long-lived keys**: Keyless signing eliminates key management burden.
- **Registry**: Signatures stored as OCI 1.1 referrers alongside the image.

### Provenance attestations

- **SLSA Level**: Build L2 via `docker/build-push-action` with `provenance: true`.
- **Builder**: GitHub-hosted runner (not self-hosted), meeting L2 requirements.
- **Attestation content**: Builder identity, source commit, build timestamp,
  build parameters.

### Verification

Consumers verify artifacts using:

```bash
# Verify image signature
cosign verify \
  --certificate-identity "https://github.com/ORG/REPO/.github/workflows/ci-images.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/ORG/portarium-control-plane@sha256:DIGEST

# Verify and extract SBOM attestation
cosign verify-attestation \
  --certificate-identity "..." \
  --certificate-oidc-issuer "..." \
  --type spdxjson \
  ghcr.io/ORG/portarium-control-plane@sha256:DIGEST
```

A reusable `verify-provenance.yml` workflow gates deployments.

### Domain model

A pure domain model (`artifact-provenance-v1.ts`) codifies the supply-chain
integrity rules:

- `ReleaseArtifact` -- type representing a signed, attested release artifact.
- `ArtifactVerificationPolicy` -- configurable policy for deployment gates.
- `validateReleaseArtifact()` -- validates artifact metadata completeness.
- `checkArtifactAgainstPolicy()` -- checks artifact against deployment policy.

## Consequences

- Every container image push produces: signature + SBOM attestation +
  SLSA provenance attestation.
- Deployment workflows must call `verify-provenance.yml` before applying images.
- The domain model enables policy-as-code for artifact verification, testable
  without CI infrastructure.
- Adding new artifact types (Helm charts, CLI binaries) requires extending
  the CI pipeline and domain model.
- Sigstore keyless signing depends on GitHub Actions OIDC; self-hosted runner
  builds would need `sigstore-key-pair` method instead.
