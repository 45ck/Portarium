# ADR-0104 — CI-to-Cloud OIDC Trust Policy Hardening

**Status:** Accepted
**Date:** 2026-02-23
**Bead:** bead-v8sj
**Supersedes:** None (extends ADR-0087)

---

## Context

ADR-0087 established OIDC federation as the mechanism for CI/CD pipeline
authentication to cloud providers. This ADR addresses the enforcement gap:
the policy is documented but not machine-verified. Drift can occur when
contributors add new workflows or modify existing ones without following
the OIDC trust conventions.

Specific risks:

1. **Credential regression** — A new workflow introduces `AWS_ACCESS_KEY_ID`
   as a secret, bypassing OIDC federation.
2. **Identity pin drift** — Cosign verification removes or weakens the
   `--certificate-identity` constraint, allowing images signed by forks.
3. **Permission sprawl** — A workflow requests `id-token: write` without
   actually using it for OIDC exchange, or omits it when cloud access is
   needed (causing silent authentication failures in production).
4. **Credential persistence** — `actions/checkout` with `persist-credentials: true`
   leaves a git token accessible to subsequent steps, widening the blast
   radius of a compromised action.

---

## Decision

**Enforce the OIDC trust policy via automated CI tests that scan all
workflow files on every PR.**

The test suite (`src/infrastructure/adapters/ci-oidc-trust-policy-hardening.test.ts`)
validates:

| Rule                              | Check                                                             |
| --------------------------------- | ----------------------------------------------------------------- |
| No long-lived credentials         | Reject `AWS_ACCESS_KEY_ID`, `GCP_SA_KEY`, `AZURE_CLIENT_SECRET`   |
| OIDC permission present           | Workflows using cloud providers must declare `id-token: write`    |
| Cosign issuer pin                 | `--certificate-oidc-issuer` set to GitHub Actions token endpoint  |
| Cosign identity pin               | `--certificate-identity` constrains to this repo's CI workflow    |
| No insecure flags                 | `--insecure-ignore-*` is never used with cosign                   |
| Role ARN in vars                  | `AWS_DEPLOY_ROLE_ARN` is a repository variable, not a secret      |
| No persist-credentials: true      | `actions/checkout` does not persist credentials                   |
| Deploy workflows use Environments | CD workflows reference a GitHub Environment for OIDC subject pins |
| Keyless signing                   | ci-images uses OIDC keyless signing, no static cosign key         |

These checks run as part of `npm run test` (vitest) and therefore gate every
PR via `ci:pr`.

---

## Consequences

### Positive

- Policy drift is caught at PR time, not during a security review.
- New contributors get immediate feedback if they add a workflow that
  violates the trust model.
- The test file serves as living documentation of the OIDC trust policy,
  co-located with the infrastructure code.

### Negative / Accepted Risks

- The tests are heuristic (string-matching on YAML content, not full
  YAML parsing). This is acceptable because:
  - GitHub Actions YAML is simple and predictable.
  - False positives are safe (they block a PR, prompting review).
  - Full YAML parsing would require a YAML parser dependency.

---

## Links

- ADR-0087 — CI OIDC Federation for Cloud Access
- ADR-0083 — Environment model
- `src/infrastructure/adapters/ci-oidc-trust-policy-hardening.test.ts`
- `.github/workflows/verify-provenance.yml` — Sigstore verification
