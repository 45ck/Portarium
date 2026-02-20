# Robot Intent Command V1

> Status: **Draft** | Created: 2026-02-21
> Domain: `src/domain/machines/robot-intent-command-v1.ts`

## Purpose

Defines the value objects for high-level robot intent commands dispatched by Portarium to local robot systems, and the execution evidence returned by robots.

## Intent Command

An `IntentCommandV1` describes *what* a robot should do, not *how*. The local robot system is responsible for translating the intent into low-level motion commands.

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| schemaVersion | `1` | Yes | Fixed schema version. |
| intentId | `IntentId` | Yes | Unique identifier for this intent command. |
| commandType | enum | Yes | One of: `navigate`, `pick`, `place`, `inspect`, `dock`. |
| targetParams | `TargetParams` | Yes | Target specification (waypoint or coordinates). |
| safetyConstraints | `SafetyConstraints` | Yes | Safety limits for execution. |
| requiredApprovalTier | `ExecutionTier` | Yes | Minimum approval tier before dispatch. |
| issuedAtIso | ISO 8601 string | Yes | When the command was issued. |
| issuedBy | string | Yes | Identifier of the issuing principal. |
| description | string | No | Human-readable description of the intent. |

### Target Parameters

**Waypoint target:**
- `kind: "waypoint"` + `waypointId: string`

**Coordinates target:**
- `kind: "coordinates"` + `x: number`, `y: number`, `z?: number`

### Safety Constraints

| Field | Type | Required | Description |
|---|---|---|---|
| maxVelocityMps | number | No | Maximum velocity in meters per second (must be positive). |
| geofenceBoundary | string | No | Geofence boundary identifier. |
| collisionAvoidance | boolean | Yes | Whether collision avoidance must be active. |

## Execution Evidence

An `ExecutionEvidenceV1` records the outcome of an intent command execution on the robot.

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| schemaVersion | `1` | Yes | Fixed schema version. |
| evidenceId | `ExecutionEvidenceId` | Yes | Unique identifier for this evidence record. |
| intentId | `IntentId` | Yes | The intent command this evidence relates to. |
| executionStatus | enum | Yes | One of: `dispatched`, `executing`, `completed`, `failed`, `aborted`. |
| telemetrySnapshot | `TelemetrySnapshot` | No | Point-in-time telemetry at recording. |
| completedAtIso | ISO 8601 string | No | When execution completed (for terminal states). |
| recordedAtIso | ISO 8601 string | Yes | When this evidence was recorded. |

### Telemetry Snapshot

| Field | Type | Required | Description |
|---|---|---|---|
| batteryPercent | number | No | Battery level (0-100). |
| positionX | number | No | X coordinate. |
| positionY | number | No | Y coordinate. |
| velocityMps | number | No | Current velocity in m/s. |

## Validation Rules

- `schemaVersion` must equal `1`.
- `commandType` must be a known intent command type.
- `targetParams.kind` must be `"waypoint"` or `"coordinates"`.
- `safetyConstraints.maxVelocityMps` must be positive if present.
- `telemetrySnapshot.batteryPercent` must be between 0 and 100 if present.
- `requiredApprovalTier` must be a valid `ExecutionTier`.

## Governance Boundary

See `docs/governance/robot-governance-boundary.md` for the full governance boundary between Portarium and local robot systems. Key principle: Portarium dispatches intent commands; local systems execute them and report evidence.
