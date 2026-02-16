# ADR-0029: Evidence Integrity via Tamper-Evident Controls

## Status

Accepted

## Context

Claiming "immutable evidence" requires technical backing, not just application-level append-only semantics. Auditors and compliance frameworks (SOX, SOC 2) expect tamper-evident controls that can be independently verified. Without cryptographic guarantees, the immutability claim is an implementation detail rather than a verifiable property.

## Decision

Evidence integrity is enforced via tamper-evident controls:

- **Hash chaining**: each evidence entry includes a `hashSha256` field containing the SHA-256 digest of its content, and a `previousHash` field linking to the hash of the preceding entry, forming a verifiable chain.
- **Signed digests**: evidence batches are signed with platform-managed keys, enabling third-party verification without direct storage access.
- **WORM storage**: artifact storage uses Write Once Read Many semantics where the storage backend supports it.
- **Verification tooling**: platform-provided tooling can validate the hash chain at any time, and external auditors can run independent verification against exported chain data.

## Consequences

- "Immutable evidence" becomes technically credible and audit-defensible under SOX, SOC 2, and similar frameworks.
- Requires hash computation on every evidence write, though overhead is minimal for SHA-256.
- WORM storage may limit storage backend choices or increase storage costs.
- Provides a foundation for third-party audit verification without granting direct system access.
- Hash chain breaks become a detectable, alertable integrity incident.
