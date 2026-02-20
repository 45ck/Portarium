# Bridge Node Architecture

**Bead:** bead-0689
**Priority:** P3
**Date:** 2026-02-21

## Overview

The Portarium bridge node is the component that connects edge devices (robots,
IoT gateways, industrial controllers) to the control plane. It supports three
transport tiers to cover the full spectrum from rapid prototyping to
production-grade fleet deployment.

## Transport Tiers

### Tier 1: rosbridge (WebSocket/JSON)

**Use case:** Rapid development, single-robot prototyping, CI test harnesses.

| Property         | Value                          |
| ---------------- | ------------------------------ |
| Protocol         | WebSocket (RFC 6455)           |
| Serialization    | JSON                           |
| Authentication   | None (local network only)      |
| Encryption       | Optional TLS (wss://)          |
| Latency          | ~10-50ms (JSON parse overhead) |
| Scalability      | 1-5 robots                     |
| ROS 2 dependency | rosbridge_server package       |

**Connection flow:**

```text
Bridge Node  <-- WebSocket -->  rosbridge_server  <-- ROS 2 -->  Robot nodes
```

**Advantages:**

- Zero certificate management.
- Works from any language with WebSocket support.
- Easy to debug (human-readable JSON).

**Limitations:**

- No authentication or authorization at the transport layer.
- JSON serialization overhead for high-frequency topics.
- Single rosbridge server becomes a bottleneck beyond 5 robots.

### Tier 2: DDS-Security (SROS 2)

**Use case:** Production ROS 2 deployments, fleet-scale operations.

| Property         | Value                               |
| ---------------- | ----------------------------------- |
| Protocol         | RTPS (DDS)                          |
| Serialization    | CDR (Common Data Representation)    |
| Authentication   | PKI (X.509 certificates via SROS 2) |
| Encryption       | AES-256-GCM (per DDS-Security spec) |
| Latency          | ~1-5ms (zero-copy capable)          |
| Scalability      | 100+ robots per domain              |
| ROS 2 dependency | Full ROS 2 stack with sros2 package |

**Connection flow:**

```text
Bridge Node  <-- DDS/RTPS (encrypted) -->  Robot nodes
     |
     +-- SROS 2 keystore (PKI certificates)
```

**Advantages:**

- Native ROS 2 performance.
- Per-topic access control via DDS governance policies.
- No intermediate server (peer-to-peer).

**Limitations:**

- Requires SROS 2 PKI provisioning (see `ros2-bridge-architecture.md`).
- Harder to debug (binary protocol).
- ROS 2 installation required on bridge host.

### Tier 3: MQTT

**Use case:** Constrained IoT devices, non-ROS edge gateways, cross-firewall.

| Property         | Value                                    |
| ---------------- | ---------------------------------------- |
| Protocol         | MQTT 5.0                                 |
| Serialization    | JSON or Protobuf                         |
| Authentication   | Username/password or client certificates |
| Encryption       | TLS 1.3                                  |
| Latency          | ~5-20ms                                  |
| Scalability      | 10,000+ devices per broker               |
| ROS 2 dependency | None                                     |

**Connection flow:**

```text
IoT Device  <-- MQTT/TLS -->  Broker (Mosquitto)  <-- MQTT -->  Bridge Node
                                                                      |
                                                              Portarium CP
```

**Advantages:**

- Smallest footprint (runs on microcontrollers).
- Works across NAT/firewalls.
- Massive device scalability.
- No ROS 2 dependency on device side.

**Limitations:**

- Request-response patterns require convention (reply topics).
- Less rich QoS than DDS.
- Requires an MQTT broker (Mosquitto, EMQX, HiveMQ).

## Topic ACL Model for MQTT

MQTT topic ACLs enforce per-device authorization at the broker level.

### Topic namespace

```text
portarium/<workspace_id>/telemetry/<device_id>/<metric>     (device -> bridge)
portarium/<workspace_id>/commands/<device_id>/<action>       (bridge -> device)
portarium/<workspace_id>/status/<device_id>                  (device -> bridge)
portarium/<workspace_id>/bridge/heartbeat                    (bridge -> broker)
```

### ACL rules (Mosquitto `acl_file` format)

```text
# Bridge node -- full access to workspace topics
user portarium-bridge-%w
topic readwrite portarium/%w/#

# Device -- publish telemetry and status, subscribe to commands
pattern read portarium/%u/commands/#
pattern write portarium/%u/telemetry/#
pattern write portarium/%u/status/#

# Deny cross-device access (implicit deny-all)
```

Where `%w` is the workspace ID and `%u` is the authenticated device identity.

### Dynamic ACL with Portarium

For dynamic ACL management, the MQTT broker authenticates against the
Portarium control plane:

1. **Device connects** with client certificate or username/token.
2. **Broker calls** `POST /api/v1/workspaces/{ws}/mqtt/authorize`
   with topic, client ID, and action (subscribe/publish).
3. **Control plane** evaluates workspace policy and returns allow/deny.

This requires the Mosquitto `auth_plugin` or equivalent broker plugin.

## Transport Selection Guide

Use this decision tree to select the appropriate transport tier:

```text
Is the device a ROS 2 node?
  |
  +-- Yes: Is this production / fleet-scale?
  |     |
  |     +-- Yes --> Tier 2 (DDS-Security / SROS 2)
  |     |
  |     +-- No  --> Tier 1 (rosbridge WebSocket)
  |
  +-- No: Is the device constrained (microcontroller, no ROS)?
        |
        +-- Yes --> Tier 3 (MQTT)
        |
        +-- No  --> Tier 3 (MQTT) or Tier 1 (rosbridge via HTTP-to-WS proxy)
```

### Selection matrix

| Criterion          | Tier 1 (rosbridge) | Tier 2 (DDS) | Tier 3 (MQTT) |
| ------------------ | ------------------ | ------------ | ------------- |
| Setup complexity   | Low                | High         | Medium        |
| Authentication     | None               | PKI          | Cert / Token  |
| Latency            | Medium             | Low          | Medium        |
| Device scalability | 1-5                | 100+         | 10,000+       |
| ROS 2 required     | Yes (bridge side)  | Yes (both)   | No            |
| Firewall-friendly  | Yes                | No           | Yes           |
| CPU on device      | Low                | Medium       | Minimal       |
| Best for           | Dev / CI           | ROS fleet    | IoT / edge    |

## Bridge node internal architecture

```text
+------------------------------------------------------+
|                  Bridge Node Process                  |
|                                                      |
|  +-------------+  +------------+  +--------------+   |
|  | Transport   |  | Command    |  | Telemetry    |   |
|  | Selector    |  | Translator |  | Forwarder    |   |
|  +------+------+  +-----+------+  +------+-------+   |
|         |               |                |            |
|  +------v------+  +-----v------+  +------v-------+   |
|  | rosbridge   |  | Portarium  |  | Portarium    |   |
|  | DDS-Sec     |  | API Client |  | API Client   |   |
|  | MQTT Client |  |            |  |              |   |
|  +-------------+  +------------+  +--------------+   |
+------------------------------------------------------+
```

### Component responsibilities

- **Transport Selector** -- Reads configuration, instantiates the appropriate
  transport client (rosbridge, DDS, or MQTT).
- **Command Translator** -- Converts Portarium `MissionCommand` payloads into
  transport-specific messages (ROS action goals, MQTT command messages).
- **Telemetry Forwarder** -- Subscribes to device telemetry topics and
  batches them into Portarium API calls.

## References

- `docs/integration/ros2-bridge-architecture.md` -- SROS 2 PKI details
- ADR-0070 -- Hybrid orchestration-choreography architecture
- [MQTT 5.0 specification](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html)
- [Mosquitto ACL documentation](https://mosquitto.org/man/mosquitto-conf-5.html)
- [DDS-Security specification](https://www.omg.org/spec/DDS-SECURITY/)
