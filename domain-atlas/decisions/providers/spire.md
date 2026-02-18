# spire

- Provider ID: `spire`
- Port Families: `RoboticsActuation`
- Upstream: `https://github.com/spiffe/spire`
- Pinned commit: `c3b8f176fc494a1ddaec5813cdc30c8f5d1c0e15`
- License: Apache-2.0 (`safe_to_reuse`)

## What This Is

SPIFFE/SPIRE is the workload identity framework. The SPIRE Server issues X.509 SVIDs (SPIFFE Verifiable Identity Documents) and JWT-SVIDs to attested workloads and agents. SPIRE Agents run on each robot node and attest the node's identity (via TPM, Kubernetes, AWS, etc.) to obtain cryptographic identities.

In the Portarium robotics stack, SPIRE provides:

- **Robot node identity**: each robot/edge gateway gets a SPIFFE ID (e.g., `spiffe://fleet.example.com/robot/arm-7`)
- **mTLS identity**: SVIDs enable mutual TLS between Portarium and robot adapters without pre-shared API keys
- **Federation**: cross-cluster trust bundles allow multi-site robot fleets to authenticate across domain boundaries
- **Short-lived credentials**: SVIDs rotate automatically (default 1h TTL), eliminating long-lived secrets

## Why Selected

SPIRE is the reference implementation for SPIFFE-based workload identity and is required for Portarium's Zero-Trust security posture for edge robotics. Without SPIRE, the robotics adapter layer requires static API keys or certificates — fragile and unscalable for dynamic fleets.

**Scoring**: Priority 3 — security infrastructure layer; foundational for zero-trust robot connectivity.

## Mapping Notes (Canonical)

- `AttestedNode` → `Asset` (robot node with cryptographic identity and certificate expiry status).
- `Certificate` → `Document` (X.509 SVID document, auditable and time-bounded).
- `RegistrationEntry` → `ExternalObjectRef` (workload identity policy records).
- `Bundle` → `ExternalObjectRef` (trust domain federation artefact).
- `Selector` → `ExternalObjectRef` (attestation predicate, linked from RegistrationEntry).

## Capability Matrix Notes

- All read operations (`fetchSVID`, `fetchBundle`, `listAgents`) are `Auto` tier.
- `createRegistrationEntry` / `deleteRegistrationEntry` are `HumanApprove` — wrong entries allow impersonation.
- Idempotency: SPIRE deduplicates entries by spiffe_id + selector set; update uses `revision_number`.
- Rollback: delete the incorrect registration entry.

## Open Questions

- Should Portarium act as a SPIRE-aware client (fetching its own SVID) or as an operator of the SPIRE Server (managing robot registration entries)?
- TPM-based attestation for edge gateways — requires hardware plugin; feasible in first release?
