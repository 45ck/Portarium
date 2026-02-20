# ADR-0075: Multi-Region Readiness Strategy

**Beads:** bead-0645 (bead-0682 original reference)
**Status:** Proposed
**Date:** 2026-02-21

## Context

Portarium is currently deployed as a single-region system. As adoption grows, customers in
regulated industries (finance, healthcare, government) require data residency guarantees,
and operational teams need disaster-recovery capabilities with defined RPO/RTO targets.

This ADR defines the readiness strategy for multi-region deployment without requiring
immediate implementation. The goal is to ensure architectural decisions made today do not
preclude multi-region operation tomorrow.

## Decision

Adopt a phased multi-region readiness strategy with explicit RPO/RTO targets per tier.

### Availability tiers

| Tier | RPO | RTO | Scope |
|------|-----|-----|-------|
| Tier 1 (Critical) | < 1 min | < 5 min | Control plane API, policy evaluation, approval gates |
| Tier 2 (Important) | < 15 min | < 30 min | Workflow execution (Temporal), event stream |
| Tier 3 (Standard) | < 1 hour | < 4 hours | Telemetry storage, analytics, developer portal |

### Component strategies

#### 1. Temporal (workflow orchestration)

- **Strategy:** Temporal multi-cluster replication with namespace-level failover
- **Active-active:** Not recommended for v1 due to conflict resolution complexity
- **Active-passive:** Primary region handles all workflow starts; standby region replays
  from replicated history on failover
- **Data:** Temporal persistence uses the regional Postgres instance; cross-region
  replication handled at the database layer
- **Readiness gate:** Temporal namespace configuration must include replication settings
  even in single-region deployments

#### 2. PostgreSQL (primary datastore)

- **Strategy:** Streaming replication with synchronous commit to regional standby
- **Primary-standby:** Single writable primary per region; promote standby on failover
- **Cross-region:** Asynchronous streaming replication to disaster-recovery region
  (RPO determined by replication lag, typically < 1 second under normal load)
- **Managed option:** AWS RDS Multi-AZ with cross-region read replicas, or
  Aurora Global Database for sub-second replication
- **Schema constraint:** All tenant-scoped queries must include `workspace_id` partition
  key to enable future horizontal sharding

#### 3. S3 / MinIO (artifact and evidence storage)

- **Strategy:** Cross-region replication (CRR) for compliance-critical buckets
- **Buckets requiring CRR:** evidence bundles, audit logs, artifact store
- **Buckets not requiring CRR:** telemetry raw data (re-ingestible from edge), temp uploads
- **MinIO (self-hosted):** Use MinIO site replication between regional MinIO clusters
- **Versioning:** All CRR-eligible buckets must have versioning enabled

#### 4. NATS JetStream (event stream)

- **Strategy:** NATS super-cluster with cross-region stream mirroring
- **Streams requiring mirroring:** `portarium.events.*` (CloudEvents), `portarium.audit.*`
- **Streams not requiring mirroring:** `portarium.telemetry.raw.*` (high-volume, re-ingestible)
- **Consumer model:** Region-local consumers read from mirrored streams; no cross-region
  consumer connections

#### 5. Vault (credential storage)

- **Strategy:** Vault replication (performance replication for read scaling,
  disaster recovery replication for failover)
- **Seal keys:** Region-specific auto-unseal via cloud KMS (AWS KMS, GCP Cloud KMS)
- **Constraint:** Credential grants are workspace-scoped; Vault namespace per workspace
  simplifies replication scope

#### 6. Edge gateways (gRPC telemetry/control)

- **Strategy:** DNS-based routing to nearest regional control plane endpoint
- **Failover:** Edge gateways maintain a prioritized list of regional endpoints;
  automatic reconnection on connection loss
- **Constraint:** Telemetry frames include source timestamps; out-of-order delivery
  across regions is tolerated by the ingestion pipeline

### Network topology

```
                    ┌─────────────────────┐
                    │   Global DNS (Route  │
                    │   53 / Cloud DNS)    │
                    └──────┬──────────────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
   ┌──────────────────┐     ┌──────────────────┐
   │  Region A (Primary)│     │  Region B (DR)    │
   │  ┌──────────────┐ │     │  ┌──────────────┐ │
   │  │ Control Plane │ │     │  │ Control Plane │ │
   │  │ (API + Policy)│ │     │  │ (Standby)     │ │
   │  └──────────────┘ │     │  └──────────────┘ │
   │  ┌──────────────┐ │     │  ┌──────────────┐ │
   │  │ Temporal      │◄├─────├──┤ Temporal      │ │
   │  │ (Primary)     │ │     │  │ (Standby)     │ │
   │  └──────────────┘ │     │  └──────────────┘ │
   │  ┌──────────────┐ │     │  ┌──────────────┐ │
   │  │ PostgreSQL    │─├─────├──► PostgreSQL    │ │
   │  │ (Primary)     │ │     │  │ (Replica)     │ │
   │  └──────────────┘ │     │  └──────────────┘ │
   │  ┌──────────────┐ │     │  ┌──────────────┐ │
   │  │ NATS          │◄├─────├──► NATS          │ │
   │  │ (Super-cluster)│ │    │  │ (Super-cluster)│ │
   │  └──────────────┘ │     │  └──────────────┘ │
   └──────────────────┘     └──────────────────┘
```

### Readiness gates (things to do now)

1. **Workspace-scoped partitioning:** All queries include `workspace_id`; no global
   queries without explicit scope (already enforced by domain primitives)
2. **Idempotency keys:** All mutating commands accept idempotency keys for safe replay
3. **UTC timestamps:** All persisted timestamps are UTC; no timezone-dependent logic
4. **Stateless API servers:** Control plane HTTP/gRPC servers carry no in-process state
5. **Configuration externalization:** Region-specific config via environment variables,
   not hardcoded values
6. **Health endpoints:** All services expose `/healthz` and `/readyz` for load-balancer
   integration

## Consequences

### Positive
- Architectural decisions today are multi-region-compatible
- Clear RPO/RTO targets per component guide infrastructure investment
- Phased approach avoids premature complexity

### Negative
- Active-passive adds operational complexity vs single-region
- Cross-region replication adds cost (egress, storage)
- Temporal multi-cluster is not trivial to operate

### Risks
- Replication lag during high-load periods may exceed Tier 1 RPO targets
- Split-brain scenarios during network partitions require manual intervention
- Edge gateway reconnection during regional failover may cause brief telemetry gaps
