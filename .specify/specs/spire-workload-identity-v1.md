# SPIRE Workload Identity v1

**Status:** Accepted
**Bead:** bead-0671
**Date:** 2026-02-21

## Context

In-cluster communication between Portarium components (control plane, execution
plane, agents) must be secured with mutual TLS. Application code should not
manage certificates directly.

## Decision

Deploy SPIRE as the workload identity provider using the SPIFFE framework.

### Key design points

1. **Trust domain:** `portarium.io`
2. **Node attestation:** Kubernetes Projected Service Account Token (PSAT)
3. **Workload attestation:** Kubernetes WorkloadAttestor (namespace + service account)
4. **Certificate lifecycle:** 1-hour TTL, automatic 30-minute rotation
5. **Socket path:** `/run/spire/sockets/agent.sock` (mounted into workload pods)

### SPIFFE ID scheme

Each workload receives a SPIFFE ID based on namespace and service account:
`spiffe://portarium.io/ns/<namespace>/sa/<service-account>`

### RFC 8705 support

Certificate-bound access tokens per RFC 8705 will be implemented by:

1. Extracting the X.509 SVID thumbprint during JWT minting
2. Embedding the thumbprint in the `cnf.x5t#S256` claim
3. Verifying thumbprint match during token validation

## Manifests

- `infra/kubernetes/base/spire/spire-server.yaml`
- `infra/kubernetes/base/spire/spire-agent.yaml`
- `infra/kubernetes/base/spire/registration-entries.yaml`

## ADR

See [ADR-0076](../../docs/adr/0076-spire-workload-identity-mtls.md).

## Consequences

- mTLS is transparent to application code via sidecar proxy.
- Certificate rotation is fully automated.
- Workload identity is tied to Kubernetes service accounts.
