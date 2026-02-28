# ADR-0115: Mandatory Sidecar-or-Gateway Enforcement Model for Agent Egress

**Status:** Accepted
**Date:** 2026-03-01
**Bead:** bead-0832
**Related ADRs:** ADR-0034 (untrusted execution containment), ADR-0065 (external execution plane), ADR-0072 (OpenClaw multi-tenant isolation), ADR-0073 (all roads through control plane), ADR-0074 (untrusted tool sandbox), ADR-0076 (SPIRE workload identity), ADR-0100 (JWT short-expiry policy), ADR-0102 (OpenClaw full integration)

---

## Context

Portarium agents and execution-plane workloads perform outbound calls to Systems of Record (SoRs), external APIs, and tool endpoints. ADR-0073 established the "all roads through control plane" principle, requiring that every externally-effectful call passes through governed control-plane contracts. ADR-0034 and ADR-0072 further mandate deny-by-default egress and per-workspace isolation.

However, the enforcement architecture for outbound agent calls has not been formalized. Existing controls rely on Kubernetes NetworkPolicy for coarse egress restriction and on developer discipline for routing calls through approved paths. This leaves enforcement gaps:

1. **No application-layer interception.** NetworkPolicy operates at L3/L4 and cannot inspect or authorize individual HTTP/gRPC calls against Portarium policy.
2. **No identity binding on egress.** Outbound calls from agent pods do not carry verifiable workload identity, making it impossible to attribute, audit, or revoke specific egress flows.
3. **No fail-closed guarantee.** If the network policy is misconfigured or absent, agents can reach arbitrary endpoints without detection.
4. **Migration uncertainty.** Teams need a clear, phased path from the current state (coarse network controls) to the target state (application-layer enforcement with identity binding).

This ADR formalizes two complementary enforcement patterns, defines the invariants they must satisfy, specifies the identity and audit requirements, and provides a migration plan with rollback strategy.

---

## Decision

### Enforcement patterns

Define two complementary enforcement patterns for agent egress. Both patterns are valid deployment choices; operators select based on infrastructure maturity and compliance requirements. Both patterns MUST satisfy the same invariants (Section: Invariants).

#### Pattern A: Action API Interception

The control plane intercepts all externally-effectful operations at the application layer before they reach the network.

```
+------------------+      +---------------------+      +------------------+
| Agent Runtime    | ---> | Control Plane       | ---> | SoR / External   |
| (execution pod)  |      | Action API          |      | Endpoint         |
|                  |      | - policy evaluation |      |                  |
|                  |      | - SoD check         |      |                  |
|                  |      | - credential inject |      |                  |
|                  |      | - evidence capture  |      |                  |
+------------------+      +---------------------+      +------------------+
```

**Mechanism:**

- Agent code invokes Portarium Action API endpoints (e.g., `POST /v1/workspaces/{wsId}/runs/{runId}/actions`) instead of calling SoRs directly.
- The Action API handler evaluates policy tier, SoD constraints, and approval gates before dispatching the call to the execution plane.
- SoR credentials are resolved from the credential vault at dispatch time; agents never possess SoR credentials.
- Evidence is captured synchronously as part of the action dispatch.

**Enforcement surface:** Application layer (L7). The agent SDK makes control-plane invocation the default and only integration path.

**When to use:** Greenfield agent development; environments where all agent code uses Portarium SDKs; workloads where the control plane can intercept every action without latency concerns.

#### Pattern B: Sidecar/Gateway Proxy

A co-located proxy (sidecar or shared egress gateway) intercepts all outbound network traffic from agent pods and enforces policy before forwarding.

```
+------------------+      +---------------------+      +------------------+
| Agent Runtime    | ---> | Egress Proxy        | ---> | SoR / External   |
| (execution pod)  |      | (sidecar or gateway)|      | Endpoint         |
|                  |      | - mTLS termination  |      |                  |
|                  |      | - allowlist check   |      |                  |
|                  |      | - identity assertion|      |                  |
|                  |      | - audit log emit    |      |                  |
+------------------+      +---------------------+      +------------------+
```

**Mechanism:**

- All outbound traffic from agent pods is routed through the egress proxy via iptables/CNI redirection (transparent proxy) or explicit proxy configuration (HTTPS_PROXY / connect-based).
- The proxy validates the destination against a per-workspace egress allowlist sourced from `MachineRegistrationV1.executionPolicy.egressAllowlist`.
- The proxy asserts the caller's workload identity (SPIFFE SVID from SPIRE, per ADR-0076) and injects it into the outbound request as a signed header or mTLS client certificate.
- Calls to non-allowlisted destinations are rejected with a structured deny response and an audit event.
- The proxy emits a CloudEvents-format audit record for every egress attempt (allowed or denied).

**Enforcement surface:** Network layer (L3/L4) for routing, application layer (L7) for allowlist and identity assertion.

**When to use:** Brownfield agent runtimes; third-party tool runtimes (Activepieces, Langflow) that cannot be modified to use Portarium SDKs; defense-in-depth alongside Pattern A.

### Combined deployment (recommended)

For production deployments, both patterns SHOULD be deployed together:

- Pattern A provides application-layer governance (policy, approval, SoD, evidence).
- Pattern B provides network-layer backstop (deny-by-default egress, identity assertion, audit).
- The combination satisfies defense-in-depth: even if an agent bypasses the Action API (e.g., via a library that makes direct HTTP calls), the egress proxy catches and denies the unauthorized call.

---

### Invariants

The following invariants MUST hold regardless of which pattern is deployed.

#### INV-1: No-Direct-Egress

Agent runtime pods MUST NOT have direct network paths to any endpoint outside the cluster, except through an approved enforcement point (Action API or egress proxy). This is enforced by:

- Kubernetes NetworkPolicy denying all egress from agent pods except to control-plane service IPs and egress-proxy service IPs.
- CNI-level enforcement (Calico/Cilium) as the primary control; Kubernetes NetworkPolicy as the secondary control.
- CI validation: infrastructure-as-code linting rejects manifests that grant unrestricted egress to agent-class pods.

#### INV-2: Fail-Closed Behavior

If the enforcement point (Action API or egress proxy) is unavailable, unreachable, or returns an error:

- The agent's outbound call MUST fail. No fallback to direct connectivity is permitted.
- The failure MUST be logged as a structured audit event with `outcome: "enforcement_unavailable"`.
- The agent runtime SHOULD surface the failure to the orchestration layer so the run can be retried or escalated.

Specific fail-closed scenarios:

| Scenario                          | Behavior                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Egress proxy pod is down          | Agent pod cannot route outbound (NetworkPolicy blocks direct path); call fails with connection refused. |
| Egress proxy rejects destination  | HTTP 403 with structured error; audit event emitted.                                                    |
| Action API is unreachable         | SDK returns `EnforcementUnavailable` result; run step is retried or escalated.                          |
| Allowlist is empty or missing     | All egress denied; operator must configure allowlist before agents can make outbound calls.             |
| SPIFFE SVID is expired or missing | Egress proxy rejects the call; agent pod must re-attest with SPIRE before retrying.                     |

#### INV-3: No Credential Leakage

Agent runtime pods MUST NOT possess SoR credentials at rest or in memory. Credentials are:

- Stored in the credential vault (Vault-backed, workspace-scoped).
- Resolved at dispatch time by the Action API (Pattern A) or injected by the egress proxy from a sidecar-local credential agent (Pattern B).
- Never passed through agent code, environment variables, or mounted secrets.

---

### Identity model

Agent egress identity is built on two layers, binding workload identity to authorization tokens.

#### Layer 1: Workload identity (mTLS / SPIFFE)

Per ADR-0076, all agent pods receive a SPIFFE SVID from SPIRE:

- **SPIFFE ID format:** `spiffe://portarium.io/ns/{namespace}/sa/{service-account}`
- **Certificate lifecycle:** 1-hour TTL, 30-minute rotation window, automatic via SPIRE agent.
- **Verification:** The egress proxy (Pattern B) or the control-plane Action API (Pattern A) verifies the caller's SVID via mTLS handshake before processing any request.
- **Certificate-bound tokens (RFC 8705):** When a JWT is issued for an agent workload, the SVID thumbprint is embedded in the `cnf.x5t#S256` claim. The enforcement point verifies that the presenting certificate matches the token's binding. This prevents token replay from a different workload.

#### Layer 2: Authorization token (JWT)

Per ADR-0100, agent workloads use short-lived JWTs:

- **Maximum expiry:** 15 minutes for access tokens.
- **Required claims:** `sub` (agent identity), `workspace_id`, `scope` (permitted action categories), `cnf` (certificate binding).
- **Issuance:** The control plane mints agent tokens upon successful workload attestation. Tokens are workspace-scoped and action-scope-limited.
- **Validation:** Every enforcement point validates the JWT signature (via JWKS), expiry, workspace scope, and certificate binding before allowing egress.

#### Identity verification matrix

| Enforcement point        | mTLS (SVID)      | JWT validation | Certificate binding (RFC 8705) | Workspace scope check |
| ------------------------ | ---------------- | -------------- | ------------------------------ | --------------------- |
| Action API (Pattern A)   | Required         | Required       | Required                       | Required              |
| Egress Proxy (Pattern B) | Required         | Required       | Required                       | Required              |
| NetworkPolicy (baseline) | N/A (L3/L4 only) | N/A            | N/A                            | N/A                   |

---

### Audit requirements

Every egress attempt (successful or denied) MUST produce a structured audit record. This applies to both Pattern A and Pattern B enforcement points.

#### Audit record schema

```
EgressAuditEvent {
  specversion:    "1.0"                         // CloudEvents
  type:           "io.portarium.egress.attempt"
  source:         "/enforcement/{pattern}"      // "action-api" or "egress-proxy"
  id:             uuid
  time:           ISO 8601 timestamp
  datacontenttype: "application/json"
  data: {
    workspaceId:    WorkspaceId
    agentId:        AgentId
    machineId:      MachineId | null
    runId:          RunId | null
    correlationId:  CorrelationId
    destination:    string                      // target URL or host:port
    method:         string                      // HTTP method or protocol
    outcome:        "allowed" | "denied" | "enforcement_unavailable"
    denyReason:     string | null               // e.g., "destination_not_in_allowlist"
    identityAsserted: boolean                   // true if SVID was verified
    tokenBound:     boolean                     // true if RFC 8705 binding verified
    latencyMs:      number
  }
}
```

#### Audit integrity

- Audit records are append-only and tamper-evident (per ADR-0029).
- Records are emitted as CloudEvents (per ADR-0032) to the platform event stream.
- Retention follows the evidence lifecycle policy (ADR-0028).
- Denied egress attempts MUST be surfaced in the Cockpit security dashboard and trigger an alert if the deny rate exceeds a configurable threshold per workspace.

---

### Threat assumptions

This enforcement model is designed against the following threat assumptions.

| ID  | Threat                                                 | Assumed attacker capability                                                        | Mitigation                                                                                                                |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| T1  | Compromised agent code makes direct SoR calls          | Agent runtime executes attacker-controlled code that attempts outbound connections | INV-1 (no direct egress) + Pattern B (proxy blocks unauthorized destinations)                                             |
| T2  | Agent exfiltrates data to attacker-controlled endpoint | Agent attempts to send workspace data to a non-allowlisted host                    | Pattern B allowlist enforcement + audit alerting on denied egress                                                         |
| T3  | Token theft and replay from different workload         | Attacker obtains a valid JWT and attempts to use it from a different pod           | RFC 8705 certificate binding; SVID mismatch causes rejection                                                              |
| T4  | Egress proxy bypass via DNS tunneling or ICMP          | Agent uses non-HTTP protocols to exfiltrate data                                   | NetworkPolicy restricts all protocols (not just TCP); DNS queries are routed through cluster DNS only; ICMP is blocked    |
| T5  | Cross-workspace lateral movement                       | Compromised agent in workspace A attempts to reach resources in workspace B        | Workspace-scoped allowlists + workspace claim in JWT + per-workspace Gateway deployment (ADR-0072)                        |
| T6  | Credential extraction from memory                      | Attacker dumps agent process memory to find SoR credentials                        | INV-3 (no credential in agent memory); credentials resolved at enforcement point only                                     |
| T7  | Enforcement point compromise                           | Attacker compromises the egress proxy or Action API                                | Defense-in-depth (both patterns deployed); SPIRE attestation limits blast radius; proxy runs in gVisor sandbox (ADR-0074) |

**Out of scope for this ADR:**

- Supply-chain attacks on the egress proxy binary itself (covered by ADR-0113, SBOM/signing/provenance).
- Denial-of-service against the enforcement point (covered by quota-aware execution, ADR-0030).
- Physical access to cluster nodes.

---

### Migration phases

Migration from the current state (Kubernetes NetworkPolicy only) to the target state (Pattern A + Pattern B) follows three phases.

#### Phase 0: Baseline (current state)

- Kubernetes NetworkPolicy provides coarse deny-by-default egress for agent pods.
- Agents use Portarium Action API via SDK (Pattern A) by convention, not enforcement.
- No egress proxy deployed.
- SPIRE is deployed but not yet required for egress (ADR-0076).

**Exit criteria:** All agent pods have NetworkPolicy applied; SPIRE SVIDs are issued to all agent workloads.

#### Phase 1: Egress proxy deployment (audit mode)

- Deploy the egress proxy as a sidecar (or per-namespace gateway) for agent pods.
- Configure the proxy in **audit-only mode**: all traffic is forwarded, but every egress attempt is logged as an `EgressAuditEvent`.
- Validate that audit events correctly capture destination, identity, and workspace correlation.
- Identify and remediate any agent code that bypasses the Action API (direct SoR calls visible in audit logs).
- Update `MachineRegistrationV1.executionPolicy.egressAllowlist` for all registered machines.

**Duration:** 2-4 weeks.
**Exit criteria:** Audit coverage is 100% of agent egress; no gaps in event capture; allowlists are populated.

#### Phase 2: Egress proxy enforcement (deny mode)

- Switch the egress proxy from audit-only to **enforce mode**: non-allowlisted destinations are denied.
- Enable mTLS verification (SVID) and JWT certificate binding (RFC 8705) on the proxy.
- Tighten NetworkPolicy to allow egress only to the proxy (remove any residual direct-path allowances).
- Validate fail-closed behavior: proxy unavailability causes agent calls to fail, not bypass.
- Run controlled chaos tests: kill proxy pods, expire SVIDs, present invalid tokens.

**Duration:** 2-4 weeks.
**Exit criteria:** INV-1, INV-2, INV-3 are verified by integration tests and chaos tests; no direct egress paths remain.

#### Phase 3: Full enforcement (steady state)

- Both Pattern A and Pattern B are deployed and enforced.
- CI/CD pipelines include infrastructure-as-code linting that rejects manifests granting unrestricted egress to agent pods.
- Cockpit security dashboard shows egress audit events, deny rates, and enforcement health.
- Periodic penetration testing validates that no bypass paths exist.
- Operator runbook documents incident response for enforcement-point failures.

**Duration:** Ongoing.
**Exit criteria:** Quarterly pen-test confirms no bypass; SLO for enforcement-point availability is met (target: 99.9%).

### Rollback strategy

Each phase has an explicit rollback path. Rollback does not require code changes, only configuration changes.

| Phase                  | Rollback action                                               | Effect                                           | Risk accepted during rollback                                            |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Phase 1 (audit mode)   | Remove sidecar proxy from pod spec; revert to Phase 0         | No egress auditing; coarse NetworkPolicy remains | Loss of egress visibility; no enforcement regression (was not enforcing) |
| Phase 2 (enforce mode) | Switch proxy to audit-only mode; revert to Phase 1            | All egress is forwarded but logged; no denials   | Agents can reach non-allowlisted destinations; audit trail preserved     |
| Phase 3 (steady state) | Switch proxy to audit-only mode; revert to Phase 2 exit state | Same as Phase 2 rollback                         | Same as Phase 2 rollback                                                 |

**Rollback triggers:**

- Enforcement-point availability drops below 99% for more than 15 minutes.
- False-positive deny rate exceeds 1% of legitimate egress traffic (measured over 1 hour).
- Agent workload SLO (action completion latency) degrades by more than 20% due to proxy overhead.

Rollback is executed via Kubernetes ConfigMap update (proxy mode flag) and does not require pod restart if the proxy supports hot-reload of its configuration.

---

## Consequences

### Positive

- **Governance by construction.** Agent egress is enforced by infrastructure, not convention. Bypass requires simultaneous compromise of NetworkPolicy, egress proxy, and SPIRE attestation.
- **Full audit trail.** Every outbound call is logged with workspace, agent, destination, identity, and outcome. This satisfies evidence-chain requirements (ADR-0029) and supports incident investigation.
- **Identity-bound egress.** Certificate-bound tokens (RFC 8705) prevent token replay and enable fine-grained attribution of every outbound call to a specific workload identity.
- **Incremental migration.** The three-phase approach allows teams to gain confidence through audit-only deployment before enabling enforcement, with clear rollback at every stage.
- **Defense-in-depth.** The combined deployment of Pattern A and Pattern B provides overlapping enforcement surfaces. A gap in one pattern is caught by the other.

### Negative / Trade-offs

- **Latency overhead.** The egress proxy adds 1-5ms per outbound call (mTLS handshake amortized, allowlist lookup, audit emit). This is acceptable for governance-critical workloads but must be monitored against action completion SLOs.
- **Operational complexity.** The egress proxy is a new infrastructure component that must be deployed, monitored, and maintained per namespace or per pod. Failure of the proxy causes agent workload failure (fail-closed).
- **Allowlist maintenance.** Operators must maintain per-workspace egress allowlists. An incomplete allowlist causes legitimate calls to be denied. The audit-mode phase (Phase 1) is designed to discover the correct allowlist before enforcement begins.
- **Third-party runtime constraints.** Third-party runtimes (Activepieces, Langflow) that make outbound calls must operate behind the egress proxy (Pattern B). This requires transparent proxy configuration, which may not be compatible with all runtime networking models.

---

## Implementation Mapping

- `bead-0832` (this ADR): formalize enforcement architecture.
- `bead-0673` (open): deny-by-default egress enforcement for agent runtimes (NetworkPolicy baseline).
- `bead-0675` (open): sidecar proxy deployment for egress allowlist enforcement.
- `bead-0671` (open): SPIRE-backed workload identity and mTLS hardening.
- `bead-0672` (open): agents use Portarium identity only; SoR credential relocation.
- `bead-0665` (open): Portarium agent gateway service.
- `bead-0691` (open): cross-cutting migration/enforcement Phase 1.
- `bead-0693` (open): cross-cutting migration/enforcement Phase 2-3.

---

## References

- `docs/internal/adr/0034-untrusted-execution-containment.md`
- `docs/internal/adr/0065-external-execution-plane-strategy.md`
- `docs/internal/adr/0072-openclaw-gateway-multi-tenant-isolation.md`
- `docs/internal/adr/0073-all-roads-through-control-plane-enforcement.md`
- `docs/internal/adr/0074-untrusted-tool-sandbox-boundaries.md`
- `docs/internal/adr/0076-spire-workload-identity-mtls.md`
- `docs/internal/adr/ADR-0100-jwt-short-expiry-revocation-policy.md`
- `docs/internal/adr/ADR-0102-openclaw-full-integration-architecture.md`
- [SPIFFE specification](https://spiffe.io/docs/latest/spiffe-about/overview/)
- [RFC 8705 -- OAuth 2.0 Mutual-TLS Client Authentication](https://datatracker.ietf.org/doc/html/rfc8705)
- [NIST SP 800-204A -- Building Secure Microservices-based Applications Using Service-Mesh Architecture](https://csrc.nist.gov/publications/detail/sp/800-204a/final)
