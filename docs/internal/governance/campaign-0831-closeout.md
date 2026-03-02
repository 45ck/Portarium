# Campaign Closeout: bead-0831 — Enforce Agent Outbound Routing Through Portarium Control Plane

**Date:** 2026-03-02
**Status:** Complete
**ADR:** ADR-0115 (Mandatory Sidecar-or-Gateway Enforcement Model for Agent Egress)

## Campaign Objective

Deliver a defense-in-depth implementation that ensures AI machine runtimes and
related components cannot call external systems directly. All external-effecting
operations must traverse the Portarium control plane via the Agent Gateway
(Pattern A: Action API) or Sidecar Proxy (Pattern B: transparent interception).

## Bead Completion Status

All 22 linked beads are closed:

### Design and Architecture (2 beads)

| Bead      | Title                                                                  | Status |
| --------- | ---------------------------------------------------------------------- | ------ |
| bead-0832 | ADR-0115: agent egress enforcement model                               | Closed |
| bead-0859 | Review gate A: pre-implementation architecture/security/V&V inspection | Closed |

### Implementation (6 beads)

| Bead      | Title                                                                        | Status |
| --------- | ---------------------------------------------------------------------------- | ------ |
| bead-0833 | Route OpenClaw tool execution through Portarium Action API                   | Closed |
| bead-0834 | Portarium Sidecar Proxy default-deny egress with transparent interception    | Closed |
| bead-0835 | Enforce no-bypass egress with NetworkPolicy and mesh egress gateway controls | Closed |
| bead-0836 | Unify agent and proxy identity via workspace JWT and SPIFFE mTLS             | Closed |
| bead-0837 | Fail-closed proxy behavior and resilient restart strategy                    | Closed |
| bead-0838 | Egress observability and evidence chain for gateway and sidecar              | Closed |

### Integration and Testing (2 beads)

| Bead      | Title                                                             | Status |
| --------- | ----------------------------------------------------------------- | ------ |
| bead-0839 | Prove outbound-governance invariants with bypass and policy tests | Closed |
| bead-0840 | Benchmark gateway and sidecar latency/throughput envelopes        | Closed |

### Local Scenario Validation (9 beads)

| Bead      | Title                                        | Status |
| --------- | -------------------------------------------- | ------ |
| bead-0842 | Campaign: local control-plane test scenarios | Closed |
| bead-0843 | Integration harness delta                    | Closed |
| bead-0844 | OpenClaw machine dispatch scenario delta     | Closed |
| bead-0845 | Odoo FinanceAccounting run-path verification | Closed |
| bead-0846 | HumanApprove pause/resume with maker-checker | Closed |
| bead-0847 | Auth/authz negative-path contract checks     | Closed |
| bead-0848 | Policy enforcement bypass prevention checks  | Closed |
| bead-0849 | Scenario observability pack                  | Closed |
| bead-0850 | Local scenario docs and troubleshooting      | Closed |

### CI/CD and Release (2 beads)

| Bead      | Title                                          | Status |
| --------- | ---------------------------------------------- | ------ |
| bead-0851 | CI gate delta: scenario suite in ci:pr         | Closed |
| bead-0841 | Release: phased migration and CI/CD guardrails | Closed |

### Review and Governance (1 bead)

| Bead      | Title                                                           | Status |
| --------- | --------------------------------------------------------------- | ------ |
| bead-0857 | Review gate B: pre-close verification and residual-risk signoff | Closed |

## CI Evidence Summary

### Test Results

| Category                   | Files       | Tests      | Result       |
| -------------------------- | ----------- | ---------- | ------------ |
| Backend unit + integration | 434         | 5,644      | All pass     |
| Scenario integration       | 8           | 142        | All pass     |
| Sidecar/egress enforcement | 9           | 167        | All pass     |
| Dependency-cruiser         | 947 modules | 3,143 arcs | 0 violations |

### Bypass Prevention Evidence

The following bypass vectors are tested and confirmed blocked in CI:

- Direct IP address bypass (no DNS resolution) — blocked by egress allowlist
- Localhost bypass on non-sidecar ports — blocked by port restriction
- Cloud metadata endpoint (169.254.169.254) — blocked by allowlist
- Internal Kubernetes service IP access — blocked by allowlist
- DNS exfiltration via non-standard ports — blocked by port restriction
- Empty allowlist default (fail-closed) — all destinations denied
- 0.0.0.0/0 catch-all IP range — not present in any NetworkPolicy
- Unauthenticated API requests — 401 rejection at control plane
- Cross-workspace API requests — 403 rejection at control plane

### Policy-Governed Egress Evidence

The following governance controls are tested and confirmed working in CI:

- Action API interception (Pattern A) routes OpenClaw and Odoo SoR calls through control plane
- Sidecar proxy (Pattern B) enforces egress allowlists with fail-closed behavior
- Workspace JWT scope validation enforces per-request authorization
- SPIFFE SVID lifecycle management ensures workload identity
- Evidence hash chain maintains integrity across all egress operations
- Approval workflows enforce maker-checker for HumanApprove-tier actions
- Structured audit logs capture all egress decisions with W3C trace context

### CI Pipeline Gates

The `ci:pr` pipeline includes 15 checks that enforce the campaign's invariants:

1. Gate baseline integrity
2. K8s NetworkPolicy manifest validation (NEW)
3. Overlay environment drift detection (NEW)
4. Cockpit API drift
5. Migration check
6. TypeScript compilation
7. ESLint
8. Prettier formatting
9. CSpell dictionary
10. Dependency-cruiser boundary enforcement
11. Knip dead code detection
12. Unit tests with coverage thresholds
13. Scenario gate with invariant checks (NEW)
14. Storybook build
15. E2E smoke tests

## Residual Risks (from Gate B Review)

| Risk                                                | Severity | Owner         |
| --------------------------------------------------- | -------- | ------------- |
| Sidecar proxy adds ~1-3ms latency per hop           | Low      | Platform team |
| SPIRE availability is a critical-path dependency    | Medium   | Platform team |
| Envoy config complexity increases debugging surface | Low      | Platform team |

## Key Artifacts

| Artifact                       | Path                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- |
| ADR-0115                       | `docs/internal/adr/ADR-0115-agent-egress-enforcement-model.md`         |
| Deployment runbook             | `docs/internal/governance/outbound-enforcement-deployment-runbook.md`  |
| Production readiness checklist | `docs/internal/governance/outbound-enforcement-readiness-checklist.md` |
| Scenario traceability matrix   | `docs/internal/governance/scenario-traceability-matrix.md`             |
| Review gate A                  | `docs/internal/review/bead-0859-pre-implementation-review-gate-a.md`   |
| Review gate B                  | `docs/internal/review/bead-0857-pre-close-review-gate-b.md`            |
| Agent NetworkPolicy            | `infra/kubernetes/base/agent-network-policy.yaml`                      |
| Mesh egress gateway            | `infra/kubernetes/base/mesh-egress-gateway.yaml`                       |
| Sidecar proxy                  | `src/infrastructure/sidecar/sidecar-proxy.ts`                          |
| Fail-closed proxy              | `src/infrastructure/sidecar/fail-closed-proxy.ts`                      |
| Egress audit log               | `src/infrastructure/sidecar/egress-audit-log.ts`                       |
| Action-gated tool invoker      | `src/application/services/action-gated-tool-invoker.ts`                |

## Conclusion

All 22 campaign beads are closed. CI evidence demonstrates:

1. **Blocked bypass attempts**: 167 sidecar/egress tests confirm that direct
   egress, IP bypass, metadata access, DNS exfiltration, and unauthorized API
   requests are all blocked.

2. **Successful policy-governed egress**: 142 scenario tests confirm that
   OpenClaw dispatch, Odoo finance, approval workflows, and observability
   all function correctly through the Portarium control plane.

The campaign is complete.
