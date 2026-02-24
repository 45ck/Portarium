# ADR-0106: Multi-Tenant Infrastructure Isolation

- **Status:** Accepted
- **Date:** 2026-02-23
- **Bead:** bead-efra
- **Supersedes:** None
- **Related:** ADR-0076 (SPIRE workload identity), ADR-0080 (Egress Network Policy)

## Context

Portarium is a multi-tenant platform where workspaces process sensitive
automation evidence. Kubernetes pods in the same cluster share a flat network
by default -- any pod can reach any other pod. Without explicit isolation
controls, a compromised worker pod could access other tenants' data, exfiltrate
credentials, or move laterally to the control plane.

## Decision

### Isolation Tiers

We define three isolation tiers (strongest to weakest):

| Tier | Model                               | When to use                                 |
| ---- | ----------------------------------- | ------------------------------------------- |
| A    | Dedicated cluster per workspace     | Regulated industries, contractual isolation |
| B    | Shared cluster, dedicated namespace | Default production tier                     |
| C    | Shared namespace, logical isolation | Development, demo                           |

The default production tier is **B** (configurable via
`PORTARIUM_TENANCY_DEFAULT_ISOLATION_TIER`).

### Namespace Strategy

- **portarium** -- Control plane (PodSecurity=baseline to support SPIRE agent)
- **portarium-execution** -- Execution-plane workers (PodSecurity=restricted)
- **Per-workspace namespaces** -- Tier B creates a namespace per workspace
  with PodSecurity=restricted, ResourceQuota, and LimitRange

### Network Policy (deny-by-default)

Every component has a default-deny NetworkPolicy for both ingress and egress.
Explicit allow policies are added for each required communication path:

**Execution plane egress allows:**

- Control plane API (port 8080)
- Vault (port 8200)
- Temporal (port 7233)
- OTel collector (ports 4317/4318)
- DNS (port 53)
- External SoR HTTPS (ports 443/80, FQDN filtering at application layer)

**Agent egress allows:**

- Control plane API (port 8080)
- Vault (port 8200)
- DNS (port 53)

### Workload Identity Separation

- Each component has a dedicated Kubernetes ServiceAccount (never `default`)
- ServiceAccounts are annotated with Vault roles for secret access
- SPIRE registration entries scope SPIFFE IDs per workspace:
  `spiffe://portarium.io/ns/portarium/ws/<workspace-id>/sa/<service>`
- The SPIFFE identity lifecycle model (ADR-0076, bead-08gp) enforces
  workspace boundary checks at the domain layer

### RBAC (Least Privilege)

- Namespace-scoped Role (not ClusterRole) for application-level access
- Control plane: read-only access to pods, services, PDBs
- No create/delete/patch on pods -- scheduling is delegated to Temporal/Argo

### Enforcement

Domain-level validation (`src/domain/tenancy/workspace-isolation-v1.ts`):

- `validateNamespaceIsolation()` -- validates tier-specific requirements
- `validateWorkloadIdentityBinding()` -- validates SA and SPIFFE scoping
- `validateNetworkPolicyCompleteness()` -- validates deny-by-default pattern

Infrastructure-level test (`src/infrastructure/adapters/k8s-multitenant-isolation.test.ts`):

- Scans actual K8s manifests in `infra/kubernetes/base/`
- Validates NetworkPolicies, PodSecurity labels, RBAC, SPIRE config
- Runs as part of `npm run ci:pr`

## Consequences

- **Positive:** Defense-in-depth: network, identity, and RBAC isolation layers
  prevent single-point-of-failure tenant escapes.
- **Positive:** CI-enforced: adding a new component without NetworkPolicies
  will fail the test suite.
- **Negative:** Operational complexity: namespace-per-workspace requires
  automated provisioning/deprovisioning.
- **Future:** Cilium CiliumNetworkPolicy for FQDN-level egress filtering
  (tracked separately per ADR-0080).
