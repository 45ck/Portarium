# ADR-0073: All Roads Through Control Plane Enforcement Strategy

**Beads:** bead-0647
**Status:** Accepted
**Date:** 2026-02-20

## Context

Portarium governance guarantees depend on a single authoritative control path for policy,
approval, and evidence.

If agents, robots, or automations can directly call systems of record (SoRs), those calls
bypass:

- policy and SoD checks,
- approval gates,
- evidence-chain guarantees,
- tenant-scoped audit and correlation controls.

ADR-0065 and ADR-0070 already define execution-plane and orchestration boundaries, but this
project still needs an explicit enforcement strategy that makes bypass paths technically hard
and operationally non-viable.

## Decision

Adopt a three-layer enforcement model that forces all external-effecting automation through
Portarium control-plane contracts.

### 1. Identity and credential boundary

- Agents use short-lived Portarium identity only (workspace-scoped JWT/OIDC/SPIFFE-style
  workload identity), never long-lived SoR credentials.
- SoR credentials are stored and retrieved through Portarium-managed secret boundaries
  (Vault-backed execution-plane retrieval).
- Credential grants/rotation/revocation remain control-plane commands so every credential
  access path is policy-evaluable and auditable.

### 2. Network and egress boundary

- Agent runtimes are deny-by-default for outbound network access.
- Agent egress is allowlisted to Portarium endpoints (or approved local sidecar/gateway
  endpoints that proxy to Portarium controls).
- Only execution-plane components with explicit policy and allowlist configuration may reach
  external SoR endpoints.
- Inter-service traffic at trust boundaries uses mTLS/workload identity.

### 3. Developer ergonomics boundary

- Official SDKs/templates make control-plane invocation the default and easiest integration
  path.
- CI/policy checks detect and block direct-SoR integration patterns in agent code/config
  (hardcoded credentials, unapproved endpoints, non-compliant transport paths).
- Local development scaffolding includes compliant gateway/identity flows so secure defaults
  do not increase developer friction.

## Consequences

**Positive:**

- Prevents governance bypass by construction rather than convention.
- Strengthens tenant isolation and credential hygiene in mixed human/agent/robot workflows.
- Improves auditability by preserving correlation/evidence continuity across all action paths.

**Trade-offs:**

- Requires additional platform controls (identity, egress policy, gateway/sidecar tooling).
- Introduces migration work for existing direct-integration patterns.
- Requires strict CI/policy enforcement to keep ergonomics and enforcement aligned.

## Implementation Mapping

- `bead-0034` (closed): untrusted execution containment baseline.
- `bead-0415` (closed): control-plane HTTP contract handlers that establish governed entry
  points.
- `bead-0445` (closed): OpenClaw multi-tenant isolation model with default-deny
  ingress/egress posture.
- `bead-0647` (closed): this ADR and enforcement strategy formalization.
- `bead-0648` (closed): control-plane agent-routing enforcement specification contract.
- `bead-0649` (open): OpenAPI v1 routing-enforcement subset freeze with stable-path CI checks.

## Specification Linkage

- `.specify/specs/control-plane-agent-routing-enforcement-v1.md`

## OpenAPI Frozen Subset

Routing-enforcement critical v1 endpoints are frozen with `x-stability: stable` in:

- `docs/spec/openapi/portarium-control-plane.v1.yaml`

Frozen groups include:

- run lifecycle endpoints,
- approval lifecycle endpoints,
- agent and machine registration/test endpoints (heartbeat coverage),
- adapter-registration endpoints carrying capability declarations,
- work-item listing endpoint,
- event-subscription endpoint (`location-events:stream`).

CI breaking-change enforcement for stable operations is implemented in:

- `scripts/ci/openapi-breaking-check.mjs`

## Remaining Gap Tracking

Execution hardening and migration work for this strategy is tracked by:

- `bead-0672` (agents use Portarium identity only; SoR credential relocation),
- `bead-0673` (deny-by-default egress enforcement for agent runtimes),
- `bead-0665` (Portarium agent gateway service),
- `bead-0671` (SPIRE-backed workload identity and mTLS hardening),
- `bead-0691` and `bead-0693` (cross-cutting migration/enforcement phases).

## References

- `docs/adr/0029-evidence-integrity-tamper-evident.md`
- `docs/adr/0032-event-stream-cloudevents.md`
- `docs/adr/0065-external-execution-plane-strategy.md`
- `docs/adr/0070-hybrid-orchestration-choreography-architecture.md`
