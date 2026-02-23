# ADR-0105: Security Trust Signals -- OpenSSF Best Practices + SLSA Mapping

- **Status:** Accepted
- **Date:** 2026-02-23
- **Bead:** bead-0746
- **Supersedes:** None
- **Related:** ADR-0087 (CI OIDC Federation), ADR-0104 (OIDC Trust Policy Hardening)

## Context

External consumers and integrators need verifiable evidence that Portarium
follows recognized supply-chain security practices. Two widely adopted
frameworks provide this:

1. **OpenSSF Best Practices Badge** -- a self-assessment against the Core
   Infrastructure Initiative (CII) criteria covering basics, change control,
   reporting, quality, security, and analysis.
2. **SLSA (Supply-chain Levels for Software Artifacts)** -- a framework for
   artifact integrity assurance from source to deployment.

Without an explicit mapping, it is unclear which criteria the project meets and
where gaps remain. This ADR documents the current state and enforcement approach.

## Decision

### OpenSSF Best Practices Coverage

The following table maps CII/OpenSSF Best Practices criteria to current project
artifacts:

| Category       | Criterion                         | Artifact                               | Status |
| -------------- | --------------------------------- | -------------------------------------- | ------ |
| Basics         | Project website                   | README.md                              | Met    |
| Basics         | License                           | LICENSE                                | Met    |
| Basics         | Vulnerability disclosure          | SECURITY.md                            | Met    |
| Basics         | Contributing guide                | CONTRIBUTING.md / README               | Met    |
| Change control | Public VCS                        | GitHub repository                      | Met    |
| Change control | Unique version numbering          | Git tags + package.json                | Met    |
| Change control | CI automated testing              | ci.yml, merge-guard.yml                | Met    |
| Reporting      | Bug reporting process             | GitHub Issues                          | Met    |
| Reporting      | Security vulnerability reporting  | SECURITY.md (private reporting)        | Met    |
| Quality        | Automated test suite              | vitest, ci:pr gate                     | Met    |
| Quality        | Test coverage                     | test:coverage in CI                    | Met    |
| Quality        | Static analysis                   | ESLint, TypeScript strict mode, CodeQL | Met    |
| Security       | Secure development knowledge      | ADRs, security-gates.yml               | Met    |
| Security       | Dependency vulnerability scanning | npm audit, dependency-review-action    | Met    |
| Security       | Hardened delivery pipeline        | OIDC federation, keyless signing       | Met    |
| Analysis       | Dynamic analysis                  | Trivy image scanning                   | Met    |

### SLSA Level Mapping for Container Images

| SLSA Requirement                      | Level | Implementation                                       | Workflow           |
| ------------------------------------- | ----- | ---------------------------------------------------- | ------------------ |
| Build -- Scripted build               | L1    | ci-images.yml (docker/build-push-action)             | ci-images.yml      |
| Build -- Build service                | L2    | GitHub Actions (hosted runner)                       | ci-images.yml      |
| Build -- Provenance (exists)          | L1    | `provenance: true` in build-push-action              | ci-images.yml      |
| Build -- Provenance (authenticated)   | L2    | Sigstore keyless signing via OIDC                    | ci-images.yml      |
| Build -- Provenance (non-falsifiable) | L3    | Partial -- uses hosted runners but no hermetic build | Gap                |
| Source -- Version controlled          | L2    | Git + GitHub, branch protection                      | merge-guard.yml    |
| Source -- Verified history            | L3    | Commit signing not enforced                          | Gap                |
| Dependencies -- Scanned               | L2    | npm audit, Trivy, dependency-review-action           | security-gates.yml |
| Dependencies -- Complete SBOM         | L2    | SPDX SBOM via Syft, attested to registry             | ci-images.yml      |

**Current assessed level: SLSA Build L2 for container images.**

### Known Gaps (for L3+)

1. **Hermetic builds** -- builds fetch dependencies from npm registry at build
   time; not fully isolated. Requires `npm ci --prefer-offline` with a verified
   cache to close this gap.
2. **Commit signing** -- not enforced. Would require GPG/SSH signing policy and
   branch protection rule update.
3. **Build environment pinning** -- runner images are managed by GitHub, not
   pinned to specific hashes.

### Enforcement

A test suite at `src/infrastructure/adapters/openssf-slsa-trust-signals.test.ts`
validates that:

- Required repository files exist (SECURITY.md, LICENSE, README.md)
- CI workflows contain expected security controls
- Container image pipeline produces provenance, SBOM, signatures
- Verification pipeline pins identities to this repository
- Supply chain hygiene checks pass (lockfile, pinned actions, deterministic installs)

These tests run as part of `npm run test` / `npm run ci:pr`, preventing
regressions that would reduce the assessed SLSA level or invalidate OpenSSF
criteria.

## Consequences

- **Positive:** Clear, auditable mapping of security posture to recognized
  frameworks. CI-enforced so compliance cannot silently degrade.
- **Positive:** External stakeholders can reference this ADR for supply-chain
  assurance evidence.
- **Negative:** Test maintenance burden when workflows are restructured.
- **Future:** When SLSA Build L3 is targeted, this ADR should be superseded
  with updated gap closure evidence.
