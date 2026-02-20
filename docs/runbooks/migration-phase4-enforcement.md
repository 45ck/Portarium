# Migration Phase 4: Enforcement

**Bead:** bead-0693
**Date:** 2026-02-21

## Objective

Activate deny-by-default egress policies, SPIRE mTLS, and tool allowlist
enforcement so that agents can only reach SoR endpoints through the Portarium
control plane. Direct outbound calls are blocked at the network level.

## Prerequisites

- [ ] Phase 3 (Routing by Default) complete -- routing compliance > 90%.
- [ ] SPIRE server deployed in-cluster.
- [ ] Network policy controller (Cilium, Calico, or equivalent) operational.
- [ ] Tool allowlist defined per workspace.
- [ ] Monitoring and alerting from Phase 1 operational.

## Deny-by-default egress activation checklist

### 1. Audit current egress

Before activating deny-by-default, catalog all legitimate egress destinations:

```bash
# From Phase 1 visibility data
kubectl logs -l app=portarium-agent --since=7d | \
  jq -r 'select(.classification=="control-plane-routed") | .url' | \
  sort -u > legitimate-egress.txt
```

### 2. Create egress allowlist

Define the Kubernetes NetworkPolicy:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-egress-deny-default
  namespace: portarium-agents
spec:
  podSelector:
    matchLabels:
      app: portarium-agent
  policyTypes:
    - Egress
  egress:
    # Allow DNS resolution
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
    # Allow control plane
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: portarium-system
      ports:
        - protocol: TCP
          port: 443
        - protocol: TCP
          port: 3100
    # Allow SPIRE server
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: spire-system
      ports:
        - protocol: TCP
          port: 8081
```

### 3. Apply in dry-run mode first

```bash
# Cilium: enable policy audit mode
kubectl annotate netpol agent-egress-deny-default \
  policy.cilium.io/audit-mode=enabled -n portarium-agents

# Monitor audit logs for 48h
kubectl logs -l k8s-app=cilium -n kube-system | grep "audit"
```

### 4. Activate enforcement

```bash
# Remove audit annotation to enforce
kubectl annotate netpol agent-egress-deny-default \
  policy.cilium.io/audit-mode- -n portarium-agents
```

## SPIRE mTLS activation guide

### 1. Register SPIRE entries

Register the control plane and agent workloads:

```bash
# Control plane
spire-server entry create \
  -spiffeID spiffe://portarium.dev/control-plane \
  -parentID spiffe://portarium.dev/spire-agent \
  -selector k8s:ns:portarium-system \
  -selector k8s:sa:portarium-control-plane

# Agent workloads
spire-server entry create \
  -spiffeID spiffe://portarium.dev/agent/<workspace-id> \
  -parentID spiffe://portarium.dev/spire-agent \
  -selector k8s:ns:portarium-agents \
  -selector k8s:pod-label:portarium.dev/workspace:<workspace-id>
```

### 2. Configure control plane for mTLS

```yaml
# control-plane config
tls:
  mode: mtls
  spire:
    socketPath: /run/spire/sockets/agent.sock
    trustDomain: portarium.dev
  allowedSpiffeIds:
    - 'spiffe://portarium.dev/agent/*'
```

### 3. Configure agents for mTLS

```yaml
# agent config
portarium:
  baseUrl: https://control-plane.portarium-system.svc:443
  tls:
    mode: mtls
    spire:
      socketPath: /run/spire/sockets/agent.sock
```

### 4. Validate mTLS

```bash
# Check SVID issuance
spire-server entry show | grep portarium

# Verify mTLS handshake
curl --cert /tmp/svid.pem --key /tmp/svid-key.pem \
  --cacert /tmp/bundle.pem \
  https://control-plane.portarium-system.svc:443/healthz
```

## Tool allowlist enforcement configuration

### 1. Define per-workspace tool allowlists

Create a policy in the control plane:

```json
{
  "schemaVersion": 1,
  "policyId": "pol-tool-allowlist-ws-prod",
  "workspaceId": "ws-production",
  "name": "Production Tool Allowlist",
  "rules": [
    {
      "ruleType": "InlineRule",
      "condition": "tool.name in ['invoice:create', 'invoice:read', 'payment:process', 'ticket:create']",
      "effect": "Allow"
    },
    {
      "ruleType": "InlineRule",
      "condition": "true",
      "effect": "Deny",
      "reason": "Tool not on workspace allowlist."
    }
  ]
}
```

### 2. Apply via CLI

```bash
portarium policy create --file tool-allowlist.json --workspace ws-production
```

### 3. Test enforcement

```bash
# Allowed tool
portarium run start --workflow-id wf-create-invoice --workspace ws-production
# Expected: run starts successfully

# Disallowed tool (if triggered by agent)
# Expected: PolicyDenied error with reason "Tool not on workspace allowlist."
```

## Zero direct-SoR-call monitoring alert setup

### Alert definitions

```yaml
# Prometheus alerting rules
groups:
  - name: portarium-enforcement
    rules:
      - alert: DirectSorCallDetected
        expr: increase(portarium_calls_total{classification="direct-sor-call"}[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Direct SoR call detected after enforcement'
          description: >
            Agent {{ $labels.agent_id }} in workspace {{ $labels.workspace_id }}
            made a direct SoR call to {{ $labels.url }}.
            This should not happen after Phase 4 enforcement.

      - alert: EgressPolicyViolation
        expr: increase(cilium_drops_total{reason="POLICY_DENIED",direction="egress"}[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: 'Egress policy violation in agent namespace'
          description: >
            Network policy blocked egress from agent pod.

      - alert: MtlsHandshakeFailure
        expr: increase(envoy_ssl_connection_error_total[5m]) > 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'mTLS handshake failure detected'

      - alert: ToolAllowlistDenial
        expr: increase(portarium_policy_denials_total{policy_type="tool-allowlist"}[5m]) > 5
        for: 5m
        labels:
          severity: info
        annotations:
          summary: 'Multiple tool allowlist denials'
          description: >
            {{ $value }} tool calls denied by allowlist in the last 5 minutes.
            Review agent configuration.
```

### Dashboard panels

| Panel                          | Metric                                                         |
| ------------------------------ | -------------------------------------------------------------- |
| Direct SoR calls (should be 0) | `portarium_calls_total{classification="direct-sor-call"}`      |
| Egress policy drops            | `cilium_drops_total{reason="POLICY_DENIED"}`                   |
| mTLS handshake success rate    | `envoy_ssl_connection_success / total * 100`                   |
| Tool allowlist denials         | `portarium_policy_denials_total{policy_type="tool-allowlist"}` |
| SVID rotation events           | `spire_svid_rotations_total`                                   |

## Validation

- [ ] All agent pods subject to deny-by-default egress NetworkPolicy.
- [ ] Agents can only reach the control plane via mTLS.
- [ ] Direct SoR call count is zero for 48 hours.
- [ ] SPIRE SVIDs issued and rotating correctly.
- [ ] Tool allowlist enforced per workspace policy.
- [ ] All monitoring alerts configured and tested.
- [ ] All existing workflows pass end-to-end tests.

## Rollback

Rollback is staged (most to least disruptive):

1. **Tool allowlist:** Delete the policy via CLI:

   ```bash
   portarium policy delete --policy-id pol-tool-allowlist-ws-prod
   ```

2. **mTLS:** Set `tls.mode: optional` in the control plane config.
   Agents fall back to plain TLS.

3. **Egress policy:** Delete the NetworkPolicy:

   ```bash
   kubectl delete netpol agent-egress-deny-default -n portarium-agents
   ```

   Agents regain unrestricted egress.

4. **Full rollback to Phase 3:** Re-enable OpenClaw hook in audit mode
   and restore agent credentials from backup.

## Post-enforcement

Once Phase 4 is stable:

- Remove Phase 1 audit-mode logging (no longer needed).
- Archive agent credential backups (no longer needed).
- Document the enforcement state in the workspace configuration.
- Enable automated compliance reporting.
