# ADR-0075: Multi-Region Deployment Strategy

**Beads:** bead-0682
**Status:** Proposed
**Date:** 2026-02-21

## Context

Portarium must support deployments across multiple geographic regions to meet:

- Data residency requirements (GDPR, tenant-specific data sovereignty),
- Low-latency access for globally distributed workspaces,
- Disaster recovery with defined RPO/RTO targets,
- High availability during regional outages.

Current single-region architecture uses Temporal, PostgreSQL, MinIO, NATS
JetStream, and Vault. All components must be evaluated for multi-region
readiness.

## Decision

Adopt a **primary-active / secondary-standby** multi-region model for MVP,
with a roadmap to active-active for workspaces that require it.

### Component Strategy

| Component                | Multi-Region Approach                       | Notes                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Temporal**             | Multi-cluster replication                   | Temporal supports namespace-level replication across clusters with eventual consistency. Standby cluster replays workflow history from the primary. Failover is namespace-scoped.                                  |
| **PostgreSQL**           | Streaming replication + logical replication | Primary writes in the active region. Synchronous streaming replication to the standby region for hot standby. Logical replication for cross-region read replicas used by query services.                           |
| **MinIO (Object Store)** | Bucket replication                          | MinIO site replication replicates objects and metadata across regions. Evidence store objects are immutable, making replication idempotent.                                                                        |
| **NATS JetStream**       | Cluster gateway + leaf nodes                | NATS supports multi-cluster via gateway connections. Leaf nodes in secondary regions subscribe to streams with local caching.                                                                                      |
| **Vault**                | Performance replication                     | Vault Enterprise supports performance replication for read-heavy paths. Secrets are written to the primary; replicas serve reads. For open-source: separate Vault per region with shared configuration management. |
| **OTel Collector**       | Per-region collector fleet                  | Each region runs its own collector fleet. Traces and metrics are exported to both regional and central observability backends.                                                                                     |

### RPO/RTO Targets

| Scenario                 | RPO    | RTO     | Strategy                                                                      |
| ------------------------ | ------ | ------- | ----------------------------------------------------------------------------- |
| Single component failure | 0      | < 30s   | In-region redundancy (replicas, multi-AZ)                                     |
| Full region failure      | < 5min | < 15min | Namespace-level failover for Temporal; DNS-based traffic routing for HTTP API |
| Data corruption          | < 1h   | < 4h    | Point-in-time recovery from PostgreSQL WAL archive and MinIO versioning       |

### Workspace Placement

- Each workspace is assigned to a **home region** at creation time.
- Workspace metadata includes `homeRegion` and optional `replicaRegions`.
- The control plane routes workspace-scoped requests to the home region.
- Cross-region reads are served from replicas with eventual consistency warnings.

### Temporal Multi-Cluster

1. Each region runs an independent Temporal cluster.
2. Namespaces are configured with replication to the standby region.
3. Failover is triggered by:
   - Automated health check failure detection,
   - Manual operator decision via runbook.
4. After failover, the standby becomes primary for affected namespaces.
5. Failback requires re-establishing replication and a controlled switchover.

### PostgreSQL Multi-Region

1. **Active region**: Primary PostgreSQL instance handles all writes.
2. **Standby region**: Synchronous streaming replica for hot standby.
3. **Read replicas**: Logical replication to query-optimized replicas per region.
4. Schema migrations use the expand/contract pattern (existing ADR) to support
   rolling upgrades across regions.

### Object Store Replication

1. MinIO site replication is configured between regions.
2. Evidence objects are immutable (write-once, read-many).
3. Replication is asynchronous with eventual consistency.
4. Integrity is verified by comparing SHA-256 hashes in the evidence chain.

## Consequences

- Workspace creation must capture `homeRegion` selection.
- Control plane HTTP routing must be region-aware (DNS or load balancer routing).
- Temporal namespace provisioning must include replication configuration.
- Operational runbooks must cover failover, failback, and split-brain resolution.
- Cost: multi-region deployment approximately doubles infrastructure costs.
- This ADR is P3 priority; implementation follows core feature completion.
