# Outbound Enforcement Deployment Runbook

**Bead:** bead-0841
**Status:** Active
**Date:** 2026-03-02
**ADR:** ADR-0115 (Mandatory Sidecar-or-Gateway Enforcement Model for Agent Egress)

## Overview

This runbook covers the phased deployment of the enforced outbound routing model
described in ADR-0115. It operationalizes the four migration phases and provides
step-by-step instructions for sidecar injection, proxy configuration, and policy
tightening at each stage.

## Prerequisites

- Kubernetes cluster with NetworkPolicy support (Calico, Cilium, or cloud-native CNI).
- SPIRE server and agent deployed (see `infra/kubernetes/base/spire/`).
- Portarium control-plane running with Action API enabled.
- Kustomize overlays configured for target environment (`dev`, `staging`, `prod`).
- OTel Collector deployed for telemetry export.

## Phase 1: Instrumentation (Monitor-Only Sidecar)

### Objective

Deploy the egress sidecar in monitor-only mode. No traffic is blocked. All egress
is logged for baseline measurement.

### Steps

1. **Apply sidecar ConfigMap with `enforcementMode: monitor`:**

   ```bash
   # Dev environment: sidecar in monitor mode
   kubectl apply -k infra/kubernetes/overlays/dev/
   ```

   The dev overlay patches the sidecar enforcement mode to `monitor` via
   `patches/sidecar-enforcement-mode.yaml`.

2. **Inject sidecar container into agent pod templates:**

   Add the sidecar container to agent Deployments. The sidecar listens on
   `127.0.0.1:15001` and proxies all agent egress.

   ```yaml
   # Added to agent Deployment spec.template.spec.containers[]
   - name: portarium-sidecar
     image: ghcr.io/your-org/portarium-sidecar:latest
     ports:
       - containerPort: 15001
         protocol: TCP
     env:
       - name: ENFORCEMENT_MODE
         value: monitor
       - name: UPSTREAM_URL
         value: http://localhost:3000
     resources:
       requests:
         cpu: 50m
         memory: 64Mi
       limits:
         cpu: 200m
         memory: 128Mi
   ```

3. **Verify sidecar is running in monitor mode:**

   ```bash
   kubectl -n portarium-agents get pods -l portarium.io/component=agent -o wide
   # Expect 2/2 containers (agent + sidecar)

   kubectl -n portarium-agents logs <pod> -c portarium-sidecar | head -5
   # Expect: "Sidecar running in monitor mode"
   ```

4. **Validate baseline metrics appear in telemetry:**

   ```bash
   # Check Prometheus/OTel for sidecar metrics
   curl -s http://otel-collector:8888/metrics | grep portarium_egress
   ```

### Rollback

Remove sidecar container from agent pod templates. No traffic impact.

---

## Phase 2: Action API Migration

### Objective

Migrate high-volume agent actions to Pattern A (typed Action API calls). Deploy
NetworkPolicy in audit mode.

### Steps

1. **Deploy NetworkPolicy resources (audit mode):**

   The staging overlay includes the agent egress deny-all policy with an
   `audit` annotation so violations are logged but not enforced.

   ```bash
   kubectl apply -k infra/kubernetes/overlays/staging/
   ```

2. **Verify audit logs capture violations:**

   ```bash
   kubectl -n portarium-agents logs -l portarium.io/component=agent | grep "egress-violation"
   ```

3. **Migrate agent SDK calls to Action API:**

   Update agents to use `portarium.actions.execute()` instead of direct HTTP calls.
   Each migrated action should produce audit records in the evidence trail.

4. **Run integration tests to validate audit records:**

   ```bash
   npm run test -- --testPathPattern=scenario-outbound-governance
   ```

### Rollback

Revert agent SDK to direct calls. Remove audit-mode NetworkPolicy annotation.

---

## Phase 3: Sidecar Enforcement (Canary)

### Objective

Enable sidecar allowlist enforcement for a canary subset of agent pods. Switch
NetworkPolicy from audit to enforce for new deployments.

### Steps

1. **Switch sidecar to enforce mode on canary pods (10%):**

   ```bash
   # Apply staging overlay with enforcement patches
   kubectl apply -k infra/kubernetes/overlays/staging/
   ```

   The staging overlay patches sidecar enforcement mode to `enforce` and sets
   the canary percentage via pod anti-affinity or rollout strategy.

2. **Monitor canary for 7 days:**
   - Check `portarium_egress_denied_total` metric for unexpected blocks.
   - Review sidecar logs for false positives.
   - Validate latency stays within budget (P99 < 5ms per hop).

3. **Expand to 50%, then 100% of staging pods:**

   ```bash
   # After 7 days with no issues
   kubectl -n portarium-agents rollout restart deployment/agent-pool
   ```

4. **Run full scenario suite against staging:**

   ```bash
   npm run ci:scenario-gate
   ```

### Rollback

Switch sidecar back to `monitor` mode. Revert NetworkPolicy to audit.

---

## Phase 4: Full Enforcement (Production)

### Objective

Enable deny-all egress NetworkPolicy for all agent namespaces in production.
Activate fail-closed behavior for all failure modes.

### Steps

1. **Apply production overlay with full enforcement:**

   ```bash
   kubectl apply -k infra/kubernetes/overlays/prod/
   ```

   The production overlay:
   - Sets sidecar enforcement mode to `enforce`.
   - Applies deny-all egress NetworkPolicy.
   - Enables fail-closed behavior flags.

2. **Verify deny-all is active:**

   ```bash
   kubectl -n portarium-agents exec deploy/agent-pool -- \
     curl -s --connect-timeout 3 https://api.github.com 2>&1
   # Expected: connection refused or timeout
   ```

3. **Verify sidecar proxy routes allowed traffic:**

   ```bash
   kubectl -n portarium-agents exec deploy/agent-pool -- \
     curl -s http://localhost:15001/health
   # Expected: 200 OK
   ```

4. **Confirm zero direct egress ratio:**

   ```bash
   # portarium_direct_sor_ratio should be 0.0 for 48+ hours
   curl -s http://prometheus:9090/api/v1/query?query=portarium_direct_sor_ratio
   ```

5. **Run production readiness checklist:**

   See `docs/internal/governance/outbound-enforcement-readiness-checklist.md`.

### Rollback

Each level of rollback is independently reversible (see Rollback Strategy below).

---

## Rollback Strategy

| Level | Action                              | Effect                          | Time to effect |
| ----- | ----------------------------------- | ------------------------------- | -------------- |
| L1    | Patch sidecar to `monitor` mode     | Egress logged but not blocked   | < 2 minutes    |
| L2    | Delete agent egress NetworkPolicy   | All egress allowed from agents  | < 1 minute     |
| L3    | Remove sidecar container from pods  | No proxy layer; direct egress   | < 5 minutes    |
| L4    | Full rollback to pre-ADR-0115 state | Complete removal of enforcement | < 15 minutes   |

**L4 full rollback steps:**

```bash
# 1. Delete NetworkPolicy resources
kubectl delete networkpolicy -n portarium-agents -l portarium.io/adr=0115

# 2. Remove sidecar from agent pod templates
kubectl -n portarium-agents set image deployment/agent-pool portarium-sidecar=-

# 3. Revert agent SDK to pre-enforcement version
# (application-level change; requires re-deploy)

# 4. Retain audit logs for post-mortem (do NOT delete)
```

Rollback MUST be documented as a security incident since it re-opens direct
egress paths.

---

## CI/CD Guardrails

The following CI checks prevent policy drift across environments:

1. **`validate-k8s-policies`**: Validates all NetworkPolicy manifests in
   `infra/kubernetes/base/` (runs in `ci:pr`).

2. **`validate-egress-env-config`**: Compares sidecar config and NetworkPolicy
   state across dev/staging/prod overlays to detect drift (runs in `ci:pr`).

3. **Scenario gate**: Runs outbound governance integration tests that verify
   sidecar enforcement behavior matches the declared config.

See `scripts/ci/validate-k8s-policies.mjs` and
`scripts/ci/validate-egress-env-config.mjs` for implementation.

---

## Incident Response Hooks

| Trigger                               | Response                                                        |
| ------------------------------------- | --------------------------------------------------------------- |
| `portarium_egress_denied_total` spike | Check sidecar allowlist; may need to add legitimate destination |
| Sidecar crash loop                    | L1 rollback to monitor mode; investigate proxy crash logs       |
| SPIRE agent unavailable               | Agents fail to get SVID; mTLS breaks; escalate to platform team |
| Agent latency > 10ms (P99)            | Check sidecar performance; consider resource limit increase     |
| Direct egress detected in prod        | Critical security alert; investigate bypassed enforcement path  |
