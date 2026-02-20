# ADR-0076: SPIRE Workload Identity and mTLS

**Status:** Accepted
**Date:** 2026-02-21
**Bead:** bead-0671

## Context

Portarium runs multiple workload types (control plane, execution plane, agents)
that communicate over the network within a Kubernetes cluster. Without mutual TLS
(mTLS), any pod that can route to another pod can impersonate a legitimate caller.

We need workload-level identity that:

1. Is cryptographically verifiable (X.509 certificates, not just network policies).
2. Integrates with Kubernetes without requiring application-level certificate management.
3. Supports automatic rotation of short-lived certificates.
4. Aligns with the SPIFFE standard (RFC 8705 certificate-bound tokens).
5. Does not require modifications to application code (sidecar pattern).

## Decision

Deploy **SPIRE** (the SPIFFE Runtime Environment) as the workload identity provider
for in-cluster mTLS.

### Architecture

```
+-------------------+     +-------------------+
| SPIRE Server      |     | SPIRE Agent       |   (DaemonSet, per node)
| (StatefulSet)     |---->| (DaemonSet)       |
|                   |     |   |               |
| - Registration DB |     |   +-> Workload    |
| - Key Manager     |     |       Attestation |
| - Node Attestation|     |       (K8s PSAT)  |
+-------------------+     +-------------------+
                                    |
                            Unix Domain Socket
                            /run/spire/sockets/agent.sock
                                    |
                          +---------+---------+
                          | Application Pod   |
                          | (sidecar proxy    |
                          |  or Envoy)        |
                          +-------------------+
```

### SPIFFE ID assignments

| Workload           | SPIFFE ID                                                    |
|--------------------|------------------------------------------------------------- |
| Control Plane      | `spiffe://portarium.io/ns/portarium/sa/portarium-control-plane` |
| Execution Plane    | `spiffe://portarium.io/ns/portarium/sa/portarium-execution-plane` |
| Agent              | `spiffe://portarium.io/ns/portarium/sa/portarium-agent`      |

### Node attestation

K8s Projected Service Account Token (PSAT) attestor. Each node's kubelet-signed
token proves the agent is running on a legitimate cluster node.

### Workload attestation

K8s WorkloadAttestor matches pods by namespace + service account to their
registered SPIFFE ID. Only pods matching the registered selectors receive SVIDs.

### Certificate lifecycle

- SVIDs are short-lived (1 hour TTL, 30-minute rotation window).
- Rotation is automatic via the SPIRE agent; no application involvement required.
- CA key rotation follows SPIRE's built-in key manager (disk-based for initial
  deployment, migrate to KMS-backed in production hardening).

### RFC 8705 alignment

Certificate-bound access tokens (RFC 8705) can be implemented by extracting the
SVID thumbprint during JWT minting and verifying it during token validation.
This prevents token replay across different workload identities.

## Kubernetes manifests

- `infra/kubernetes/base/spire/spire-server.yaml` — StatefulSet + ConfigMap
- `infra/kubernetes/base/spire/spire-agent.yaml` — DaemonSet + ConfigMap
- `infra/kubernetes/base/spire/registration-entries.yaml` — SPIFFE ID registrations

These are design-stage manifests. Production deployment requires:

1. Persistent volume for SPIRE server data
2. KMS-backed key manager instead of disk
3. HA SPIRE server deployment (replicas > 1)
4. Network policy for SPIRE server access

## Consequences

- All in-cluster communication can be secured with mTLS without application changes.
- Workload identities are cryptographically bound to specific Kubernetes service accounts.
- Short-lived certificates limit the window of exposure if a certificate is compromised.
- SPIRE adds operational complexity (server, agent DaemonSet, registration management).
- Future: sidecar proxy (bead-0675) will consume SVIDs for transparent mTLS.

## References

- [SPIFFE specification](https://spiffe.io/docs/latest/spiffe-about/overview/)
- [SPIRE architecture](https://spiffe.io/docs/latest/spire-about/spire-concepts/)
- [RFC 8705 — OAuth 2.0 Mutual-TLS Client Authentication](https://datatracker.ietf.org/doc/html/rfc8705)
- [Kubernetes PSAT attestor](https://github.com/spiffe/spire/blob/main/doc/plugin_server_nodeattestor_k8s_psat.md)
