# Robot Governance Boundary: Portarium vs Local Robot System

> Status: **Active** | Effective: 2026-02-21
> References: ADR-0070 (hybrid orchestration/choreography), ADR-0073 (routing enforcement)

## Purpose

This document defines the governance boundary between Portarium (the platform control plane) and local robot systems (onboard controllers, firmware, edge compute). The boundary is non-negotiable for safety: Portarium never governs real-time motion, and local systems never override platform-level safety constraints.

## Portarium Governs

| Responsibility | Description |
|---|---|
| **Mission assignment** | Selecting which robot receives a mission, dispatching intent commands, and tracking mission lifecycle (dispatched, executing, completed, failed, aborted). |
| **Safety constraints** | Defining geofence boundaries, maximum velocity limits, and collision avoidance requirements per intent command. Constraints travel with the `IntentCommandV1` payload. |
| **Approval gates** | Enforcing the `requiredApprovalTier` for high-risk actuation commands (e.g., `HumanApprove` for pick/place in occupied zones). Approval decisions are recorded as evidence. |
| **Evidence capture** | Recording `ExecutionEvidenceV1` entries for every dispatched intent, including telemetry snapshots, completion timestamps, and failure reasons. Evidence is immutable and auditable. |
| **Fleet telemetry aggregation** | Ingesting heartbeats, location events, and telemetry from all fleet members. Aggregated data feeds the cockpit dashboards and observability stack. |
| **Policy evaluation** | Evaluating workspace-level policies (execution tiers, blast-radius constraints, tool allowlists) before any intent command is dispatched to a robot. |
| **Capability handshake** | Verifying that the target machine declares the capabilities required by the intent command before dispatch. |

## Local Robot System Governs

| Responsibility | Description |
|---|---|
| **Real-time motion control** | Path planning, trajectory execution, joint control, and PID loops. These operate at frequencies (100 Hz+) incompatible with platform-level orchestration latency. |
| **Obstacle avoidance** | Lidar, sonar, and camera-based obstacle detection and reactive avoidance. The local system must avoid collisions regardless of platform intent. |
| **Emergency stops** | Hardware e-stop circuits and software safety monitors. An e-stop must halt all motion within the robot's safety reaction time, independent of network connectivity. |
| **Sensor fusion** | Combining IMU, wheel odometry, lidar, and camera data into a local pose estimate. Portarium receives the fused result, not raw sensor data. |
| **Low-level diagnostics** | Motor temperature monitoring, battery management, and hardware fault detection. Diagnostic summaries are reported upstream via heartbeat telemetry. |

## Boundary Rules

1. **Portarium never sends direct motor commands.** All platform-to-robot communication uses `IntentCommandV1` value objects that describe *what* to do, not *how* to do it.

2. **Local systems never override safety constraints.** If Portarium declares `maxVelocityMps: 1.5`, the local controller must enforce that limit. The local system may impose *stricter* limits but never *looser* ones.

3. **Emergency stops are always local.** The e-stop circuit must function without network connectivity. Portarium is notified of e-stop events via the evidence stream but cannot prevent or delay them.

4. **Heartbeat failure triggers platform-side quarantine.** If a machine misses heartbeats beyond the configured threshold, Portarium marks it as `Degraded` or `Offline` and stops dispatching new intent commands. The local system continues operating under its last-known constraints.

5. **Evidence is the source of truth.** Both sides report evidence: the local system reports execution status and telemetry, Portarium records dispatch decisions and approval outcomes. The combined evidence trail is immutable and available for audit.

## Integration Points

| Channel | Direction | Protocol | Content |
|---|---|---|---|
| Intent dispatch | Portarium -> Robot | CloudEvents over NATS (ADR-0070) | `IntentCommandV1` payload |
| Execution evidence | Robot -> Portarium | CloudEvents over NATS | `ExecutionEvidenceV1` payload |
| Heartbeat | Robot -> Portarium | HTTP POST `/v1/workspaces/{wsId}/machines/{machineId}/heartbeat` | Status, metrics, location |
| Location telemetry | Robot -> Portarium | Location event stream | `LocationEventV1` payload |
| Emergency stop notification | Robot -> Portarium | CloudEvents over NATS | E-stop event with timestamp and reason |

## Non-Negotiable Safety Invariants

- The local robot system MUST be able to stop safely if all network connectivity is lost.
- Portarium MUST NOT dispatch intent commands to machines in `Offline` or quarantined status.
- All actuation intent commands with `requiredApprovalTier` of `HumanApprove` or `ManualOnly` MUST have an approved approval record before dispatch.
- Telemetry and evidence data MUST flow in near-real-time; stale data (>30 s) triggers alerts in the observability stack.
