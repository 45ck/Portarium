# SPIRE Kubernetes Manifests

**Status:** Design-only (not production-deployable yet)
**ADR:** [ADR-0076](../../../../docs/adr/0076-spire-workload-identity-mtls.md)
**Bead:** bead-0671

## Overview

These manifests define a SPIRE deployment for in-cluster mutual TLS between
Portarium workloads. SPIRE provides SPIFFE-compliant workload identity via
X.509 SVIDs (SPIFFE Verifiable Identity Documents).

## Manifests

| File                        | Description                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `spire-server.yaml`         | SPIRE server StatefulSet with K8s PSAT node attestation, SQLite data store, disk key manager    |
| `spire-agent.yaml`          | SPIRE agent DaemonSet with K8s WorkloadAttestor, Unix socket at `/run/spire/sockets/agent.sock` |
| `registration-entries.yaml` | ConfigMap documenting SPIFFE ID assignments for Portarium workloads                             |

## SPIFFE ID assignments

| Workload        | SPIFFE ID                                                         |
| --------------- | ----------------------------------------------------------------- |
| Control Plane   | `spiffe://portarium.io/ns/portarium/sa/portarium-control-plane`   |
| Execution Plane | `spiffe://portarium.io/ns/portarium/sa/portarium-execution-plane` |
| Agent           | `spiffe://portarium.io/ns/portarium/sa/portarium-agent`           |

## Trust domain

`portarium.io`

## Production hardening (TODO)

- [ ] Replace SQLite with PostgreSQL for SPIRE server data store
- [ ] Replace disk key manager with KMS-backed key manager (AWS KMS / GCP KMS)
- [ ] Deploy SPIRE server in HA mode (replicas > 1)
- [ ] Add persistent volume for SPIRE server
- [ ] Implement certificate-bound tokens (RFC 8705)
- [ ] Add NetworkPolicy restricting access to SPIRE server
