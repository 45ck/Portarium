# gRPC Protobuf Services Contract v1

**Beads:** bead-0644 (bead-0664 original reference)

## Purpose

Define protobuf service definitions for high-frequency robot telemetry ingestion and
real-time control command dispatch, complementing the REST OpenAPI contract for
latency-sensitive robot communication paths.

## Scope

- `TelemetryService` -- robot telemetry ingestion, command acks, heartbeat
- `ControlService` -- command dispatch, bidirectional feedback, mission lifecycle

## Why gRPC (not REST)

- Robot telemetry produces high-frequency data (10-100 Hz pose updates) unsuitable for REST polling
- Bidirectional streaming enables real-time command dispatch + feedback on a single connection
- Protobuf binary encoding reduces bandwidth for constrained edge networks
- gRPC deadlines and cancellation map naturally to mission lifecycle

## Service Definitions

### TelemetryService (`proto/portarium/telemetry/v1/telemetry.proto`)

| RPC | Type | Description |
|-----|------|-------------|
| `IngestTelemetry` | Client streaming | Edge gateway streams telemetry frames |
| `AckCommand` | Unary | Robot acknowledges command execution status |
| `Heartbeat` | Unary | Gateway keep-alive with clock-drift detection |
| `StreamTelemetry` | Server streaming | Subscribe to telemetry for a workspace/robot |

### ControlService (`proto/portarium/control/v1/control.proto`)

| RPC | Type | Description |
|-----|------|-------------|
| `DispatchCommand` | Unary | Send a single command to a robot |
| `StreamFeedback` | Bidirectional | Real-time command/feedback channel |
| `GetMissionStatus` | Unary | Query current mission state |
| `CancelMission` | Unary | Request mission cancellation |

## Auth Contract

- gRPC metadata carries `authorization: Bearer {token}` (workspace-scoped JWT)
- Server interceptor validates workspace scope matches request `workspace_id`
- Edge gateways authenticate with SPIFFE-style workload identity (SPIRE)

## Message Design Invariants

- All messages include `workspace_id` for tenant isolation
- Timestamps use `google.protobuf.Timestamp` (UTC)
- Extensible payloads use `google.protobuf.Struct`
- Enums use `UNSPECIFIED = 0` sentinel per proto3 conventions
- `correlation_id` links to parent workflow run for evidence chain

## Safety Boundary

Per ADR-0073, the control plane issues high-level goals only. Safety-critical
functions (E-stop, collision avoidance, speed limits) remain at the edge gateway.
The `SafetyEvent` message type is informational -- it reports safety events to the
control plane for audit, but does not control safety actuators.

## Acceptance Criteria

1. Proto files compile with `protoc` without errors
2. Go stubs generated with `protoc-gen-go` and `protoc-gen-go-grpc`
3. Python stubs generated with `grpcio-tools`
4. All messages include workspace scoping
5. Enum values follow proto3 conventions (UNSPECIFIED = 0)
