# ADR-0053: Vertical Pack Security, Privacy, and Compliance

## Status

Accepted

## Context

Verticals serve regulated industries: education involves child data (GDPR child consent, FERPA, UK children's code, Australian Privacy Principles); hospitality involves payment data (PCI DSS). The core must provide compliance infrastructure while packs declare their specific compliance requirements.

## Decision

Build security/privacy compliance into core and expose pack-level compliance profiles.

Core provides: strong identity and authorisation controls, per-workflow approvals and evidence capture, privacy-by-design defaults (data minimisation, purpose limitation, retention policies from ADR-028).

Packs declare required compliance profiles (e.g., `edu.child-data-protection`, `hospo.pci-boundary`). Child-data protections and risk assessments are configurable policies required for education deployments. Payment security boundaries are documented for hospitality (avoid storing card data; integrate via payment provider tokenisation). Compliance profiles are auditable through the evidence chain.

## Consequences

- Easier audits; credible enterprise posture; evidence is a product feature
- Higher initial engineering burden for compliance infrastructure
- Requires governance for cross-jurisdiction deployments
- Packs must declare compliance profiles; registry enforces profile requirements at enablement

## Alternatives Considered

- **"Compliance handled by customers"** -- reduces marketability; undermines control plane value
- **Hard-code one jurisdiction** -- blocks expansion

## Implementation Mapping

ADR-0053 implementation coverage currently maps to:

- `bead-0001` (closed): versioned vertical-pack contracts and registry/resolver baseline.
- `bead-0016` (closed): workspace IAM/RBAC baseline.
- `bead-0034` (closed): PII minimization and retention/disposition verification.
- `bead-0035` (closed): tamper-evident evidence chain and signature hooks.
- `bead-0045` (closed): containment and least-privilege boundary hardening.
- `bead-0605` (closed): ADR closure mapping bead for implementation/evidence linkage.
- `bead-0606` (closed): ADR linkage verification review bead.
- `bead-0688` (closed): reference-pack compliance profile asset wiring and parsing coverage.

## Acceptance Evidence

- Pack security/compliance contract types:
  - `src/domain/packs/pack-manifest.ts`
  - `src/domain/packs/pack-compliance-profile-v1.ts`
- Compliance enablement policy evaluator:
  - `src/domain/packs/pack-enablement-compliance-v1.ts`
  - `src/domain/packs/pack-enablement-compliance-v1.test.ts`
  - `.specify/specs/pack-compliance-enablement-policy-v1.md`
- Workspace authorization baseline:
  - `src/application/iam/rbac/workspace-rbac.ts`
- Privacy and evidence-chain controls:
  - `src/domain/evidence/evidence-privacy-v1.ts`
  - `src/domain/evidence/evidence-chain-v1.ts`
- Review artifact:
  - `docs/review/bead-0605-adr-0053-implementation-mapping-review.md`
  - `docs/review/bead-0688-pack-compliance-enablement-review.md`

## Remaining Gap Tracking

- No open ADR-0053 enforcement gaps remain in this repository scope.
