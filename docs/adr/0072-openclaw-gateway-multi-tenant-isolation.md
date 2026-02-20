# ADR-0072: OpenClaw Gateway Multi-Tenant Isolation

**Beads:** bead-0445
**Status:** Accepted
**Date:** 2026-02-20

## Context

Portarium delegates machine and tool execution to external runtimes through `MachineInvokerPort`.
For OpenClaw Gateway integration, the isolation boundary must prevent:

- cross-workspace credential reuse,
- cross-workspace network reachability,
- cross-workspace data/log leakage.

ADR-0034 (untrusted execution containment) and ADR-0065 (external execution plane strategy)
already require tenant isolation and least-privilege credentials. This ADR selects the concrete
multi-tenant model for OpenClaw Gateway and defines enforceable controls.

## Decision

Use a **per-workspace Gateway deployment model** for v1.

- One workspace maps to one Gateway runtime deployment.
- The deployment is pinned to a single `workspaceId`.
- Requests with mismatched workspace context fail closed (`PolicyDenied`).
- Shared Gateway deployments across multiple workspaces are not allowed in v1.

Per-security-domain pooling is deferred until stronger isolation controls are proven in production
(for example, hardened runtime policy plus independent credential brokers with formal verification).

## Isolation Requirements and Enforcement

| Control area          | Requirement                           | Enforceable control                                                                                      |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Deployment boundary   | Workspace isolation at runtime        | Dedicated Gateway deployment per workspace; no mixed-workspace runtime                                   |
| Credential scope      | No global credentials                 | Credential grants are workspace-scoped only; no fallback shared key                                      |
| Credential delivery   | Short-lived secrets                   | Runtime credentials are injected from vault paths scoped by workspace                                    |
| Request authorization | Workspace mismatch fails closed       | Gateway adapter must bind request workspace to deployment workspace and reject mismatch                  |
| Network ingress       | Only control plane can invoke Gateway | Default-deny ingress; allow only control-plane worker identity                                           |
| Network egress        | No unrestricted outbound traffic      | Default-deny egress; allow-list only OpenClaw upstream, vault, and telemetry endpoints                   |
| Data isolation        | No shared tenant state                | No shared persistent volumes or caches across workspaces                                                 |
| Auditability          | Traceable and redact-safe execution   | Logs/events include `workspaceId`, `runId`, `correlationId`; secrets and sensitive payloads are redacted |

## Operational Runbook Requirement

Provisioning and validation for new workspace Gateway instances must follow:

- `docs/governance/openclaw-workspace-gateway-provisioning-runbook.md`

The runbook is required for bead closure readiness and release handoff.

## Consequences

Positive:

- Stronger blast-radius reduction for OpenClaw execution.
- Clear mapping between credential grants and runtime boundary.
- Straightforward audit trail for tenant scoping and incident response.

Trade-offs:

- Higher infrastructure footprint (more Gateway instances).
- More provisioning and lifecycle automation effort per workspace.

## Alternatives Considered

1. Per-security-domain pooled Gateway

- Better infrastructure efficiency.
- Rejected for v1 due larger shared-runtime blast radius and harder credential boundary proofs.

2. Single shared multi-tenant Gateway

- Lowest operational cost.
- Rejected due unacceptable cross-tenant risk for credentials and network isolation.

## Implementation Mapping

ADR-0072 is implemented through workspace-isolated deployment policy plus adapter and test
enforcement at runtime boundaries:

- `bead-0445` (closed): OpenClaw multi-tenant isolation strategy + operational runbook.
- `bead-0435` (closed): OpenClaw Gateway machine-invoker adapter baseline (credential injection,
  bounded retries, controlled invocation path).
- `bead-0436` (closed): constrained tool-invoke behavior with policy-denied fail-closed outcomes.
- `bead-0441` (closed): machine/agent contract tests including cross-workspace scope rejection.
- `bead-0442` (closed): integration tests for OpenClaw adapter behavior under retry/policy scenarios.

## Acceptance Evidence

- Isolation decision and operational controls:
  - `docs/governance/openclaw-workspace-gateway-provisioning-runbook.md`
  - `docs/governance/openclaw-tool-blast-radius-policy.md`
- Gateway adapter enforcement path:
  - `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.ts`
  - `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.test.ts`
  - `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.integration.test.ts`
- Contract and policy boundary tests:
  - `src/presentation/runtime/control-plane-handler.machine-agent.contract.test.ts`
  - `src/application/ports/machine-invoker.test.ts`
- Review linkage:
  - `bead-0635`
  - `docs/review/bead-0635-adr-0072-linkage-review.md`

## Remaining Gap Tracking

- Cross-cutting "all roads through control plane" enforcement hardening remains tracked by
  `bead-0647`.
