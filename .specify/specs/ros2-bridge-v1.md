# ROS 2 Bridge Contract v1

**Beads:** bead-0649 (bead-0688 original reference)

## Purpose

Define the contract for the Portarium ROS 2 bridge node, including topic mappings,
SROS 2 PKI provisioning, and development-mode rosbridge support.

## Scope

- Bridge node topic/service/action mappings to Portarium gRPC services
- SROS 2 certificate provisioning and rotation
- rosbridge WebSocket transport for development
- Telemetry batching and forwarding

## Bridge Node Contract

### Inputs (from Portarium gRPC)
- `DispatchCommand` -> ROS 2 Action goal (NavigateToPose, FollowWaypoints)
- `MissionCancellation` -> ROS 2 Action cancel request

### Outputs (to Portarium gRPC)
- ROS 2 topic data -> `TelemetryFrame` (batched, streamed)
- ROS 2 Action feedback -> `MissionFeedback` via `StreamFeedback`
- Safety topics -> `SafetyEvent` via `StreamFeedback`
- Action result -> `CommandAck`

## SROS 2 Contract

### Provisioning
- CA per workspace, stored in Vault
- Bridge certificate provisioned via `portarium agent register --type ros2-bridge`
- Robot certificates via fleet enrollment API
- `governance.xml` and `permissions.xml` generated per workspace

### Rotation
- Bridge certificates: auto-rotated (TTL: 7 days)
- Robot certificates: on re-enrollment or manual trigger

### Fail-closed
- Invalid/expired SROS 2 credentials cause DDS discovery failure
- No unencrypted DDS traffic in production

## Development Mode

- `PORTARIUM_ROS2_TRANSPORT=rosbridge` enables WebSocket transport
- Connects to `rosbridge_suite` server for simulation environments
- No SROS 2 security in rosbridge mode

## Acceptance Criteria

1. Bridge node design document published at `docs/integration-catalog/ros2-bridge-design.md`
2. Topic mappings cover pose, battery, diagnostics, E-stop, navigation feedback
3. SROS 2 provisioning flow documented with certificate lifecycle
4. rosbridge development mode documented
5. Configuration schema defined
