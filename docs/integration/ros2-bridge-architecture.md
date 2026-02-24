# ROS 2 Bridge Architecture with SROS 2 Provisioning

**Bead:** bead-0688
**Priority:** P3
**Date:** 2026-02-21

## Overview

The ROS 2 bridge connects robot operating system nodes to the Portarium
control plane, enabling governed actuation commands and telemetry ingestion.
Two deployment modes are supported: a WebSocket-based development mode using
rosbridge, and a production mode using DDS-Security (SROS 2).

## Architecture

```text
                  Portarium Control Plane
                         |
                    HTTPS / mTLS
                         |
              +---------------------+
              |  ROS 2 Bridge Node  |
              |  (portarium_bridge) |
              +---------------------+
                    /          \
           Dev mode            Production mode
           (rosbridge)         (DDS-Security)
              |                     |
        WebSocket/JSON         RTPS / SROS 2
              |                     |
         ROS 2 nodes           ROS 2 nodes
```

### Bridge node responsibilities

1. **Command translation** -- Convert Portarium `MissionCommand` actions into
   ROS 2 service calls or action goals (e.g., Nav2 `NavigateToPose`).
2. **Telemetry ingestion** -- Subscribe to ROS 2 topics (odometry, diagnostics,
   battery) and forward as Portarium `LocationEvent` / `RobotTelemetry` payloads.
3. **Health reporting** -- Publish agent heartbeats to the control plane.
4. **Policy enforcement** -- Reject commands that violate blast-radius policy
   (see `docs/internal/governance/openclaw-tool-blast-radius-policy.md`).

## SROS 2 PKI provisioning

### Certificate hierarchy

```text
Portarium Root CA
  |
  +-- Workspace Intermediate CA (per tenant)
        |
        +-- Bridge Node cert (CN=portarium-bridge-<workspace>)
        +-- Robot Node cert  (CN=robot-<robot-id>)
```

### Provisioning flow

1. **Bootstrap** -- The bridge node requests a certificate from the Portarium
   control plane using a bootstrap token (one-time-use, workspace-scoped).

2. **SROS 2 keystore generation** -- The bridge generates an SROS 2 keystore
   directory using `ros2 security create_keystore` and imports the signed
   certificate chain.

3. **DDS governance** -- A governance XML file restricts topics per
   robot/bridge identity:
   - Bridge can publish to `/portarium/*` topics.
   - Robots can publish to `/telemetry/*` and subscribe to `/commands/*`.
   - All other topic combinations are denied.

4. **Rotation** -- Certificates have a 90-day TTL. The bridge auto-renews
   30 days before expiry via the control plane `/certificates/renew` endpoint.

### Keystore layout

```text
sros2_keystore/
  enclaves/
    portarium_bridge/
      cert.pem
      key.pem
      governance.p7s
      permissions.p7s
    robot_<id>/
      cert.pem
      key.pem
      permissions.p7s
```

## Development mode (rosbridge)

For local development and testing, the bridge connects to ROS 2 nodes via
the rosbridge WebSocket protocol instead of DDS.

| Aspect      | Dev mode                        | Production mode         |
| ----------- | ------------------------------- | ----------------------- |
| Transport   | WebSocket (ws://localhost:9090) | RTPS over DDS-Security  |
| Auth        | None (local only)               | mTLS + SROS 2 PKI       |
| Performance | Suitable for single robot       | Fleet-scale             |
| Setup       | `ros2 launch rosbridge_server`  | SROS 2 keystore + certs |

### Dev mode configuration

```yaml
# infra/ros2-bridge/config.dev.yaml
mode: development
rosbridge:
  url: ws://localhost:9090
portarium:
  baseUrl: http://localhost:3100
  token: ${PORTARIUM_TOKEN}
  workspaceId: ws-default
```

## Production mode (DDS-Security)

### Prerequisites

- ROS 2 Jazzy or later with `sros2` package.
- SROS 2 keystore provisioned (see above).
- Network connectivity between bridge node and DDS domain.
- Portarium control plane accessible via mTLS.

### Production configuration

```yaml
# infra/ros2-bridge/config.prod.yaml
mode: production
dds:
  domainId: 42
  sros2KeystorePath: /etc/portarium/sros2_keystore
  enclaveName: portarium_bridge
portarium:
  baseUrl: https://api.portarium.example.com
  mtls:
    certPath: /etc/portarium/tls/cert.pem
    keyPath: /etc/portarium/tls/key.pem
    caPath: /etc/portarium/tls/ca.pem
  workspaceId: ${WORKSPACE_ID}
```

## Topic mapping

| ROS 2 Topic               | Direction   | Portarium API                       |
| ------------------------- | ----------- | ----------------------------------- |
| `/robot/odom`             | Robot -> CP | `POST /telemetry/location-events`   |
| `/robot/battery_state`    | Robot -> CP | `POST /telemetry/robot-diagnostics` |
| `/robot/diagnostics`      | Robot -> CP | `POST /telemetry/robot-diagnostics` |
| `/portarium/mission_goal` | CP -> Robot | Nav2 `NavigateToPose` action        |
| `/portarium/estop`        | CP -> Robot | Direct safety-critical stop         |

## Failure modes

| Failure                   | Behavior                                        |
| ------------------------- | ----------------------------------------------- |
| Control plane unreachable | Buffer telemetry locally, retry with backoff    |
| DDS certificate expired   | Bridge stops publishing, alerts via diagnostics |
| rosbridge disconnected    | Reconnect with exponential backoff (dev mode)   |
| Invalid command from CP   | Reject at bridge, log evidence, publish NACK    |

## References

- [SROS 2 Design](https://design.ros2.org/articles/ros2_dds_security.html)
- [rosbridge protocol](https://github.com/RobotWebTools/rosbridge_suite)
- ADR-0070: Hybrid orchestration-choreography architecture
- `docs/internal/governance/openclaw-tool-blast-radius-policy.md`
