# Migration Phase 4: Enforcement Runbook

**Beads:** bead-0654 (bead-0693 original reference)
**Status:** Draft
**Date:** 2026-02-21
**Prerequisites:** Phase 3 (Routing by Default) complete, >90% routing achieved

## Objective

Enable deny-by-default enforcement so that agents cannot bypass the Portarium control plane.
After this phase, direct SoR access is technically blocked -- all external-effecting work
must flow through Portarium governance controls.

## Success Criteria

- Deny-by-default egress network policy active on all agent runtimes
- SPIRE mTLS enforced for all service-to-service communication
- Tool allowlists enforced per workspace (only approved tools executable)
- OpenFGA authorization checks active on all control-plane endpoints
- `portarium_direct_sor_ratio` = 0.0 (zero direct SoR calls)
- No unauthorized SoR access possible from agent runtimes

## Runbook Steps

### Step 1: Enable deny-by-default egress network policy

Deploy Kubernetes NetworkPolicy (or Cilium CiliumNetworkPolicy) that blocks all
outbound traffic from agent pods except:

- Portarium control plane API (port 443)
- Portarium gRPC services (port 50051)
- DNS (port 53, for service discovery)
- OTel Collector (port 4317, for telemetry export)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-egress-deny-default
  namespace: portarium-agents
spec:
  podSelector:
    matchLabels:
      portarium.io/role: agent
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              portarium.io/component: control-plane
      ports:
        - port: 443
          protocol: TCP
        - port: 50051
          protocol: TCP
    - to: []  # DNS
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
    - to:
        - namespaceSelector:
            matchLabels:
              portarium.io/component: observability
      ports:
        - port: 4317
          protocol: TCP
```

**Verification:** Agent pod cannot reach external SoR endpoints directly.
```bash
kubectl exec -n portarium-agents deploy/sales-bot -- curl -s https://api.hubspot.com
# Expected: connection timeout or refused
```

### Step 2: Deploy SPIRE for mTLS

1. Deploy SPIRE server in the control-plane namespace
2. Deploy SPIRE agent DaemonSet on all worker nodes
3. Register workload entries for:
   - Control plane API server
   - Execution-plane workers
   - Agent gateway
   - Bridge nodes
4. Configure Envoy sidecar (or native SPIFFE support) for mTLS

SPIFFE ID convention:
```
spiffe://portarium.io/ns/portarium-control-plane/sa/api-server
spiffe://portarium.io/ns/portarium-agents/sa/{agent-name}
spiffe://portarium.io/ns/portarium-execution/sa/worker
```

**Verification:** Service-to-service calls fail without valid SVID.

### Step 3: Enforce tool allowlists

For each workspace, define an explicit tool allowlist:

```json
{
  "workspaceId": "ws-acme",
  "allowedTools": [
    { "tool": "invoice:create", "tier": "HumanApprove" },
    { "tool": "invoice:read", "tier": "Auto" },
    { "tool": "ticket:update", "tier": "Assisted" },
    { "tool": "contact:create", "tier": "Assisted" }
  ],
  "defaultAction": "Deny"
}
```

- Tools not in the allowlist are denied by default
- Policy evaluation checks allowlist before execution tier
- Allowlist changes require admin role + audit trail

**Verification:** Unlisted tool call returns HTTP 403 with `PolicyBlocked` reason.

### Step 4: Enable OpenFGA authorization checks

Ensure all control-plane endpoints enforce OpenFGA resource-level checks:

| Resource | Relation | Required for |
|----------|----------|-------------|
| `workspace:{id}` | `member` | Any workspace access |
| `run:{id}` | `viewer` | Read run status |
| `run:{id}` | `operator` | Start/cancel runs |
| `approval:{id}` | `approver` | Submit approval decisions |
| `agent:{id}` | `owner` | Manage agent registration |
| `credential:{id}` | `reader` | Retrieve credentials |

**Verification:** Agent without required relation receives HTTP 403.

### Step 5: Validate zero-bypass state

Run comprehensive validation:

1. **Network test:** Attempt direct SoR access from agent pods (expect failure)
2. **mTLS test:** Attempt control-plane access without valid SVID (expect failure)
3. **Allowlist test:** Attempt unlisted tool execution (expect `PolicyBlocked`)
4. **OpenFGA test:** Attempt cross-workspace access (expect 403)
5. **Metric validation:** `portarium_direct_sor_ratio` = 0.0 for 48+ hours
6. **Evidence audit:** Random sample of 100 recent runs -- all have complete evidence chain

**Verification:** All tests pass; metrics confirm zero direct SoR calls.

### Step 6: Enable enforcement alerting

Configure alerts:

| Alert | Condition | Severity |
|-------|-----------|----------|
| Direct SoR call detected | `portarium_direct_sor_ratio > 0` | Critical |
| mTLS handshake failure spike | `rate(envoy_ssl_handshake_errors) > 10/min` | Warning |
| Policy bypass attempt | `portarium_policy_bypass_attempts_total > 0` | Critical |
| Tool allowlist violation | `portarium_tool_denied_total > 0` (new tool) | Warning |

**Verification:** Test alerts fire correctly by simulating each condition.

## Rollback

Enforcement rollback is staged (reverse order):

1. **Level 1 (partial):** Relax egress policy to allow SoR access (emergency only)
2. **Level 2:** Disable tool allowlist enforcement (fall back to tier-only policy)
3. **Level 3:** Disable mTLS requirement (fall back to bearer-token auth)
4. **Full rollback:** Return to Phase 3 state (routing by default, no enforcement)

Each level has a documented runbook command and expected time to effect (< 5 minutes).

## Duration Estimate

4-6 weeks for staged rollout (one workspace at a time).

## Post-Enforcement

After enforcement is stable across all workspaces:

- Remove direct SoR credential access from Vault policies (credentials only accessible
  to execution-plane workers, not agents)
- Archive Phase 1 instrumentation (no longer needed when routing is enforced)
- Publish enforcement compliance report per workspace
