# Migration Phase 1: Visibility Contract v1

**Beads:** bead-0651 (bead-0690 original reference)

## Purpose

Define the contract for migration phase 1 (visibility), which instruments existing agents
with W3C Trace Context headers, structured side-effect logging, and baseline metrics
without making any enforcement changes.

## Scope

- W3C Trace Context injection on all agent outbound HTTP calls
- Structured logging of side-effect attempts with agent/SoR/action metadata
- Baseline metric collection (direct-SoR-call ratio, agent inventory)
- OTel Collector deployment for trace forwarding

## Contract

### Trace Context
- All outbound HTTP calls include `traceparent` header (W3C Trace Context Level 1)
- Trace IDs are 128-bit hex; span IDs are 64-bit hex

### Structured log schema
- Required fields: `agent_id`, `timestamp`, `target_sor`, `action`, `trace_id`, `routed_via_portarium`
- `routed_via_portarium` is `false` in phase 1

### Metrics
- `portarium_sor_calls_total{agent_id, target_sor, action, routed}` counter
- `portarium_agent_heartbeats_total{agent_id}` counter
- `portarium_direct_sor_ratio{workspace_id}` gauge

## Acceptance Criteria

1. Runbook published at `docs/governance/migration-phase-1-visibility.md`
2. W3C Trace Context injection documented for Python and Node.js runtimes
3. Structured log schema defined with required fields
4. Baseline metrics defined with Prometheus naming conventions
5. Rollback procedure documented (additive-only, no enforcement)
