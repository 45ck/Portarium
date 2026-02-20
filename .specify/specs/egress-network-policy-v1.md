# Egress Network Policy v1

**Status:** Accepted
**Bead:** bead-0673
**Date:** 2026-02-21

## Context

Agent and execution-plane pods must not have unrestricted egress. Unrestricted
outbound access increases the blast radius of a compromised workload: an attacker
could exfiltrate data or pivot to external services.

## Decision

Apply deny-by-default egress NetworkPolicies to all Portarium workload pods, with
explicit allow rules for required internal and external communication paths.

### Agent pods (`portarium.io/component: agent`)

| Target                  | Port  | Protocol | Purpose                       |
|-------------------------|-------|----------|-------------------------------|
| control-plane           | 8080  | TCP      | Heartbeat, work-item API      |
| vault (namespace)       | 8200  | TCP      | Credential retrieval          |
| kube-system (DNS)       | 53    | UDP/TCP  | Service discovery             |

### Execution-plane pods (`portarium.io/component: execution-plane`)

| Target                  | Port  | Protocol | Purpose                       |
|-------------------------|-------|----------|-------------------------------|
| control-plane           | 8080  | TCP      | API callbacks, evidence       |
| vault (namespace)       | 8200  | TCP      | Credential retrieval          |
| temporal (namespace)    | 7233  | TCP      | Workflow orchestration        |
| otel-collector          | 4317/4318 | TCP  | Telemetry export              |
| kube-system (DNS)       | 53    | UDP/TCP  | Service discovery             |

### External SoR egress

External System of Record endpoints are **not** allowed by default. Per-machine
egress allowlists from `MachineExecutionPolicyV1.egressAllowlist` will be
enforced via per-workspace NetworkPolicy annotations in a follow-up bead.

## Files

- `infra/kubernetes/base/network-policies/agent-egress-deny.yaml`
- `infra/kubernetes/base/network-policies/execution-plane-egress.yaml`

## Consequences

- All agent and execution-plane pods start with zero egress; communication
  paths are explicitly documented and auditable.
- Adding a new internal dependency requires updating the network policy.
- External SoR access requires per-workspace policy extension (future bead).
