# ADR-0115: Mandatory Sidecar-or-Gateway Enforcement Model for Agent Egress

**Status:** Accepted
**Date:** 2026-03-02
**Bead:** bead-0832

---

## Context

Portarium agents execute workflow actions that require outbound network calls to
external systems of record (SoRs). ADR-0073 establishes the "all roads through
control plane" principle, ADR-0076 defines SPIRE-based workload identity with mTLS,
and ADR-0074 specifies untrusted tool sandbox boundaries. However, none of these
ADRs prescribe the concrete enforcement mechanism that prevents an agent from
making direct outbound calls that bypass the control plane.

Without a mandatory enforcement layer, the no-direct-egress invariant depends on
developer discipline and code review alone. A compromised or misconfigured agent
could:

- Call SoR APIs directly using cached or leaked credentials.
- Bypass policy evaluation, approval gates, and SoD checks.
- Produce actions with no audit trail, breaking evidence-chain guarantees.
- Exfiltrate tenant data to arbitrary endpoints.

We need an enforcement model that makes direct egress technically impossible
(fail-closed), not merely discouraged.

### Related decisions

| ADR | Relationship |
|-----|-------------|
| ADR-0065 | Execution plane strategy — defines the runtime boundary agents operate within |
| ADR-0070 | Hybrid orchestration/choreography — defines event flow topology |
| ADR-0073 | All-roads-through-control-plane — the invariant this ADR enforces |
| ADR-0074 | Untrusted tool sandbox — containment boundary for tool execution |
| ADR-0076 | SPIRE workload identity — the identity substrate this ADR leverages |
| ADR-0100 | JWT short-expiry revocation — token lifetime constraints |

---

## Decision

Adopt a **dual-pattern enforcement model** for agent egress. All agent workloads
MUST use one of two approved patterns. Direct outbound network access from agent
pods is denied by default.

### Pattern A: Action API Interception

The agent calls a Portarium-provided Action API (HTTP or gRPC) to request
external actions. The control plane evaluates policy, records evidence, retrieves
credentials from the secret boundary, and executes the outbound call on behalf of
the agent.

```
+------------------+       +---------------------+       +------------------+
| Agent Workload   | ----> | Portarium Action API | ----> | External SoR     |
| (deny-all egress)|       | (control plane)      |       | (target system)  |
+------------------+       +---------------------+       +------------------+
                           | - Policy evaluation  |
                           | - SoD check          |
                           | - Credential fetch   |
                           | - Evidence recording  |
                           +----------------------+
```

**When to use:** Standard workflow actions, connector-based integrations,
any action where the control plane already has a typed Action definition.

### Pattern B: Sidecar/Gateway Proxy

The agent makes outbound HTTP/gRPC calls through a co-located sidecar proxy
(Envoy or purpose-built gateway) that intercepts all egress traffic. The proxy
enforces allowlists, injects identity headers, streams audit logs, and
terminates connections to non-approved destinations.

```
+------------------+       +-------------------+       +------------------+
| Agent Workload   | ----> | Egress Sidecar    | ----> | External SoR     |
| (localhost only) |       | (Envoy/Gateway)   |       | (allowlisted)    |
+------------------+       +-------------------+       +------------------+
                           | - Dest allowlist   |
                           | - mTLS termination |
                           | - JWT validation   |
                           | - Audit stream     |
                           +--------------------+
```

**When to use:** Agentic flows (Langflow, LLM tool calls) where the agent
needs HTTP-level flexibility, or legacy integrations not yet ported to
typed Actions.

### No-Direct-Egress Invariant

Agent pods MUST operate under a deny-all egress network policy. The only
permitted egress destinations are:

1. **Portarium control-plane endpoints** (Action API, event bus).
2. **Localhost sidecar proxy** (Pattern B, port-restricted).
3. **SPIRE agent socket** (`/run/spire/sockets/agent.sock`).
4. **Kubernetes DNS** (for service discovery of approved endpoints).

All other outbound connections are dropped at the network policy level.
This is enforced by Kubernetes `NetworkPolicy` resources applied to agent
namespaces.

```yaml
# Simplified NetworkPolicy — agent namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-deny-all-egress
  namespace: portarium-agents
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              portarium.io/plane: control
      ports:
        - port: 443
          protocol: TCP
    - to:
        - ipBlock:
            cidr: 127.0.0.1/32
      ports:
        - port: 15001  # sidecar proxy
          protocol: TCP
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
```

### Fail-Closed Behavior

If any enforcement component is unavailable, agent egress MUST fail rather
than degrade to allow-all:

| Failure mode | Behavior |
|-------------|----------|
| Sidecar proxy crashes | Agent connections to localhost:15001 fail; no fallback path exists |
| NetworkPolicy controller unavailable | Kubernetes default-deny remains in effect |
| SPIRE agent unavailable | No SVID issued; mTLS handshake fails; proxy rejects |
| Action API unavailable | Agent receives 503; retry with backoff; no direct bypass |
| Allowlist config missing | Proxy defaults to empty allowlist (deny all destinations) |

### Identity Model

Agent identity combines two layers:

1. **Workload identity (mTLS/SPIFFE):** Each agent pod receives a short-lived
   X.509 SVID from SPIRE (ADR-0076). The SPIFFE ID encodes the agent type
   and tenant:
   ```
   spiffe://portarium.io/ns/portarium-agents/sa/agent-<type>/tenant/<tenant-id>
   ```

2. **Request-level identity (JWT):** Each action request carries a short-lived
   JWT (ADR-0100) issued by the control plane. The JWT contains:
   - `sub`: agent workload identity (SPIFFE ID)
   - `aud`: target Action API or sidecar proxy
   - `scope`: permitted action types for this request
   - `tenant_id`: tenant context
   - `workflow_run_id`: correlation to the originating workflow
   - `exp`: short expiry (max 5 minutes)

The sidecar proxy (Pattern B) validates both layers:
- mTLS handshake verifies the SVID against SPIRE trust bundle.
- JWT signature and claims are verified before proxying the request.
- Requests without valid identity on both layers are rejected (HTTP 401).

### Audit Requirements

All egress — whether via Pattern A or Pattern B — MUST produce structured
audit records:

| Field | Source | Required |
|-------|--------|----------|
| `timestamp` | Proxy/API server clock | Yes |
| `agent_spiffe_id` | mTLS peer certificate | Yes |
| `tenant_id` | JWT claim | Yes |
| `workflow_run_id` | JWT claim | Yes |
| `destination_host` | Outbound request | Yes |
| `destination_port` | Outbound request | Yes |
| `http_method` | Outbound request | Yes |
| `http_path` | Outbound request | Yes |
| `response_status` | Outbound response | Yes |
| `policy_decision` | Policy engine result | Yes |
| `latency_ms` | Proxy/API measurement | Yes |
| `request_body_hash` | SHA-256 of request body | Pattern A only |

Audit records are emitted as CloudEvents (ADR-0032) to the platform event bus.
Retention follows evidence lifecycle policy (ADR-0028).

### Threat Assumptions

This enforcement model assumes the following threat model:

| Threat | Mitigation |
|--------|-----------|
| **Compromised agent code** attempts direct egress | NetworkPolicy denies all non-allowlisted egress at kernel level |
| **Credential theft** from agent memory | Agents never hold SoR credentials; credentials are in Vault, retrieved by control plane or sidecar at call time |
| **JWT replay** to escalate scope | Short expiry (5 min), single-use nonce, audience binding |
| **Sidecar bypass** via raw socket | NetworkPolicy restricts egress to localhost:15001 only; raw sockets to external IPs are dropped |
| **DNS exfiltration** | DNS egress limited to kube-system CoreDNS; external DNS resolvers blocked |
| **SPIRE compromise** | SPIRE server is in a hardened namespace with separate RBAC; node attestation prevents rogue agents |
| **Tenant isolation breach** | SPIFFE ID includes tenant; sidecar validates tenant claim matches allowlist scope |

---

## Migration Phases

### Phase 1: Instrumentation (weeks 1-4)

- Deploy egress sidecar in **monitor-only mode** (log but do not block).
- Instrument all existing agent outbound calls to identify direct egress paths.
- Produce a baseline report of destinations, frequencies, and latencies.
- No behavioral change for running agents.

### Phase 2: Action API migration (weeks 5-8)

- Migrate high-volume agent actions to Pattern A (typed Action API calls).
- Deploy NetworkPolicy in **audit mode** (log violations, do not enforce).
- Update agent SDKs to default to Action API for all supported action types.
- Integration tests validate that migrated actions produce correct audit records.

### Phase 3: Sidecar enforcement (weeks 9-12)

- Enable sidecar allowlist enforcement for Pattern B workloads.
- Switch NetworkPolicy to **enforce mode** for new agent deployments.
- Existing agents remain in audit mode during migration window.
- Canary deployment: enforce on 10% of agent pods, validate for 1 week.

### Phase 4: Full enforcement (weeks 13-16)

- Enable NetworkPolicy enforcement for all agent namespaces.
- Remove monitor-only sidecar mode; all proxied traffic is subject to allowlist.
- Enable fail-closed behavior for all failure modes.
- Decommission any direct-egress code paths in agent SDKs.

---

## Rollback Strategy

Each phase is independently reversible:

| Phase | Rollback action | Impact |
|-------|----------------|--------|
| Phase 1 | Remove sidecar DaemonSet | No impact; monitor-only |
| Phase 2 | Revert agent SDK to direct calls | Agents bypass Action API; audit gaps |
| Phase 3 | Switch NetworkPolicy back to audit mode | Violations logged but not blocked |
| Phase 4 | Roll back to Phase 3 (canary enforcement) | Partial enforcement; known-good state |

Full rollback to pre-ADR state requires:
1. Delete `agent-deny-all-egress` NetworkPolicy.
2. Remove sidecar proxy from agent pod templates.
3. Revert agent SDK to pre-enforcement version.
4. Retain audit logs from enforcement period for post-mortem.

Rollback MUST be documented as a security incident since it re-opens direct
egress paths.

---

## Consequences

### Positive

- Direct agent egress is technically impossible, not just policy-discouraged.
- Every outbound call is audited with tenant, workflow, and identity context.
- Credential exposure surface is minimized: agents never hold SoR credentials.
- Enforcement is layered (network policy + proxy + identity), providing defense
  in depth against any single layer being bypassed.
- Migration is incremental; no big-bang cutover required.

### Negative

- Sidecar proxy adds latency to outbound calls (~1-3 ms per hop).
- Operational complexity increases: sidecar lifecycle, SPIRE availability, and
  NetworkPolicy correctness become critical-path dependencies.
- Agents that currently make direct HTTP calls require SDK migration.
- Debugging outbound failures requires correlating agent logs, sidecar logs,
  and NetworkPolicy events.

### Neutral

- Pattern A (Action API) and Pattern B (Sidecar) will coexist long-term. Teams
  choose the pattern based on integration maturity and flexibility requirements.
- The sidecar proxy technology (Envoy vs purpose-built) is an implementation
  detail not prescribed by this ADR. ADR-0076 already establishes Envoy as the
  baseline for mTLS termination.
