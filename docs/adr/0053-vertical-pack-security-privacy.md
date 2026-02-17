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
