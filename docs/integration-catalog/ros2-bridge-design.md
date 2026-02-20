# ROS 2 Bridge Design

**Beads:** bead-0649 (bead-0688 original reference)
**Status:** Draft
**Date:** 2026-02-21

## Overview

The ROS 2 Bridge connects Portarium's control plane to ROS 2 robot networks, enabling
governed mission dispatch, telemetry ingestion, and safety event reporting while preserving
the real-time guarantees of the ROS 2 ecosystem.

## Architecture

```
┌─────────────────────┐          ┌────────────────────────┐
│  Portarium Control   │          │   Edge Robot Network    │
│  Plane               │          │                         │
│                      │  gRPC    │  ┌─────────────────┐   │
│  ┌────────────────┐  │◄────────►│  │ Portarium Bridge │   │
│  │ Control Service │  │          │  │ Node (ROS 2)     │   │
│  └────────────────┘  │          │  └────────┬────────┘   │
│  ┌────────────────┐  │          │           │             │
│  │ Telemetry Svc  │  │          │  ┌────────▼────────┐   │
│  └────────────────┘  │          │  │ ROS 2 DDS       │   │
│                      │          │  │ (Nav2, MoveIt,   │   │
└─────────────────────┘          │  │  ros2_control)   │   │
                                  │  └─────────────────┘   │
                                  └────────────────────────┘
```

## Bridge Node

The bridge node is a ROS 2 node (`portarium_bridge`) that runs on the edge gateway.
It translates between Portarium gRPC messages and ROS 2 topics/services/actions.

### Responsibilities

1. **Mission dispatch:** Receive `DispatchCommand` via gRPC, translate to ROS 2 Action
   goals (e.g., `NavigateToPose`, `FollowWaypoints`)
2. **Telemetry forwarding:** Subscribe to ROS 2 topics (`/robot_pose`, `/battery_state`,
   `/diagnostics`), batch into `TelemetryFrame` messages, stream via gRPC
3. **Feedback relay:** Forward ROS 2 Action feedback to Portarium `StreamFeedback`
4. **Safety event reporting:** Subscribe to `/emergency_stop`, `/safety_state` topics,
   emit `SafetyEvent` messages to control plane
5. **Command acknowledgement:** Report `CommandAck` status as ROS 2 Action results arrive

### ROS 2 Topic Mappings

| Portarium concept | ROS 2 interface | Direction |
|-------------------|----------------|-----------|
| Mission goal dispatch | `nav2_msgs/action/NavigateToPose` | CP -> Robot |
| Mission cancellation | Action cancel request | CP -> Robot |
| Pose telemetry | `geometry_msgs/msg/PoseStamped` on `/robot_pose` | Robot -> CP |
| Battery telemetry | `sensor_msgs/msg/BatteryState` on `/battery_state` | Robot -> CP |
| Diagnostics | `diagnostic_msgs/msg/DiagnosticArray` on `/diagnostics` | Robot -> CP |
| E-stop event | `std_msgs/msg/Bool` on `/emergency_stop` | Robot -> CP |
| Navigation feedback | Action feedback channel | Robot -> CP |

## SROS 2 PKI Provisioning

All ROS 2 DDS traffic crossing trust boundaries must be secured with SROS 2.

### Key Material

- **CA:** Per-workspace certificate authority (provisioned by Portarium Vault)
- **Bridge identity:** X.509 certificate for the bridge node, signed by workspace CA
- **Robot identities:** Per-robot certificates for DDS participant authentication
- **Governance:** `governance.xml` defining domain security policies
- **Permissions:** `permissions.xml` per participant, listing allowed topics

### Provisioning Flow

1. Workspace admin registers a robot fleet in Portarium
2. Portarium generates CA and bridge certificate, stores in Vault
3. `portarium agent register --type ros2-bridge` provisions bridge identity
4. Bridge node retrieves certificate and key from Vault at startup
5. Robot certificates are provisioned through fleet enrollment API
6. `governance.xml` and `permissions.xml` are generated per workspace

### Certificate Rotation

- Bridge certificates: auto-rotated via Vault PKI (TTL: 7 days)
- Robot certificates: rotated on fleet re-enrollment or manual trigger
- CA: long-lived (1 year), manual rotation with overlap period

### Fail-Closed Behaviour

- If SROS 2 credentials are invalid or expired, DDS discovery fails
- Bridge node reports `SAFETY_EVENT_TYPE_SENSOR_FAULT` to control plane
- No unencrypted DDS traffic is permitted in production mode

## Development Mode: rosbridge

For development and simulation, the bridge supports `rosbridge_suite` as a WebSocket
transport alternative to DDS:

```
┌──────────────┐  HTTP/WS  ┌──────────────┐  ROS 2  ┌──────────┐
│ Portarium    │◄──────────►│  rosbridge   │◄────────►│  Gazebo  │
│ Bridge (dev) │            │  server      │          │  Sim     │
└──────────────┘            └──────────────┘          └──────────┘
```

- **Use case:** Local development, CI simulation, demo environments
- **Limitation:** No DDS security (SROS 2 not applicable over WebSocket)
- **Config:** `PORTARIUM_ROS2_TRANSPORT=rosbridge` environment variable

## Configuration

```yaml
# portarium-bridge-config.yaml
portarium:
  base_url: https://portarium.example.com
  workspace_id: ws-robotics-floor-2
  # Token provisioned via Vault agent sidecar

ros2:
  transport: dds  # "dds" for production, "rosbridge" for development
  domain_id: 42
  sros2:
    keystore_path: /etc/portarium/sros2/keystore
    governance: /etc/portarium/sros2/governance.xml
    permissions: /etc/portarium/sros2/permissions.xml

telemetry:
  batch_size: 50
  flush_interval_ms: 100
  topics:
    - name: /robot_pose
      type: geometry_msgs/msg/PoseStamped
      telemetry_type: pose
    - name: /battery_state
      type: sensor_msgs/msg/BatteryState
      telemetry_type: battery
```

## Deployment

- **Production:** Bridge node runs as a container on the edge gateway (K3s or bare metal)
- **Development:** Bridge node runs locally alongside Gazebo/Webots simulator
- **CI:** Bridge + rosbridge + Gazebo headless for integration tests
