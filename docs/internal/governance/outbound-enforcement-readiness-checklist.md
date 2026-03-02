# Outbound Enforcement Production Readiness Checklist

**Bead:** bead-0841
**ADR:** ADR-0115
**Date:** 2026-03-02

## Security

- [ ] Agent egress NetworkPolicy deployed (`agent-deny-all-egress`).
- [ ] NetworkPolicy verified: direct external egress blocked from agent pods.
- [ ] Sidecar proxy in `enforce` mode with empty default allowlist (fail-closed).
- [ ] SPIRE SVID rotation confirmed (< 1 hour TTL, automatic renewal).
- [ ] JWT short-expiry enforced (max 5 minutes, audience-bound).
- [ ] Vault credential isolation: agents cannot directly access SoR credentials.
- [ ] DNS exfiltration mitigation: only kube-system CoreDNS reachable.
- [ ] Cloud metadata endpoint (169.254.169.254) blocked by NetworkPolicy.
- [ ] Bypass-attempt tests pass in CI (`network-policy-enforcement.test.ts`).

## Observability

- [ ] Sidecar egress audit logs flowing to OTel Collector.
- [ ] `portarium_egress_total` and `portarium_egress_denied_total` metrics exported.
- [ ] Grafana dashboard for egress traffic patterns deployed.
- [ ] Alerting rules configured for bypass attempts and enforcement failures.
- [ ] W3C Trace Context propagated through sidecar (traceparent header).
- [ ] Latency histogram for sidecar hop visible in metrics (P50, P95, P99).

## CI/CD

- [ ] `validate-k8s-policies` passes in `ci:pr` for all NetworkPolicy manifests.
- [ ] `validate-egress-env-config` passes in `ci:pr` for overlay drift detection.
- [ ] Scenario gate tests pass (`scenario-outbound-governance.test.ts`).
- [ ] Policy bypass tests pass (`scenario-policy-bypass.test.ts`).
- [ ] Performance budget test passes (`gateway-sidecar-perf-budget.test.ts`).

## Deployment

- [ ] Kustomize overlays configured per environment:
  - Dev: sidecar in `monitor` mode.
  - Staging: sidecar in `enforce` mode.
  - Prod: sidecar in `enforce` mode with deny-all NetworkPolicy.
- [ ] Sidecar container resource requests/limits set (CPU: 50m-200m, Mem: 64-128Mi).
- [ ] Sidecar liveness/readiness probes configured.
- [ ] Rollback procedures documented and tested (L1-L4).
- [ ] Canary strategy validated in staging (10% -> 50% -> 100%).

## Incident Response

- [ ] Runbook available: `docs/internal/governance/outbound-enforcement-deployment-runbook.md`.
- [ ] On-call team briefed on sidecar failure modes and rollback levels.
- [ ] Escalation path defined for SPIRE outages.
- [ ] Security incident template updated for enforcement rollback events.
- [ ] Post-enforcement monitoring window defined (48 hours minimum).
