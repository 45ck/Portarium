# Bridge Node Architecture

**Beads:** bead-0650 (bead-0689 original reference)
**Status:** Draft
**Date:** 2026-02-21

## Overview

Portarium supports three transport tiers for connecting edge devices (robots, IoT sensors,
PLCs) to the control plane. The bridge node architecture defines how each transport tier
integrates with Portarium's governance model while respecting device constraints.

## Transport Tiers

### Tier 1: rosbridge (WebSocket) -- Development and Simulation

```
┌───────────┐  WebSocket  ┌───────────────┐  ROS 2  ┌──────────┐
│ Portarium │◄───────────►│  rosbridge    │◄────────►│ Simulator│
│ Bridge    │  (JSON)     │  server       │  (DDS)  │ (Gazebo) │
└───────────┘             └───────────────┘         └──────────┘
```

**Characteristics:**

- Transport: WebSocket (ws:// or wss://)
- Encoding: JSON (human-readable, debuggable)
- Security: TLS for transport only; no DDS-level security
- Latency: ~10-50ms (acceptable for development)
- Use case: Local development, CI simulation, demo environments, prototyping

**When to use:**

- Developer workstations running Gazebo/Webots
- CI pipeline integration tests
- Non-production demonstrations

### Tier 2: DDS-Security (SROS 2) -- Production Robot Networks

```
┌───────────┐   gRPC     ┌────────────────┐   DDS    ┌──────────┐
│ Portarium │◄───────────►│  Bridge Node   │◄────────►│  Robot   │
│ Control   │  (mTLS)    │  (ROS 2 node)  │  (SROS2) │  Fleet   │
│ Plane     │            └────────────────┘          └──────────┘
└───────────┘
```

**Characteristics:**

- Transport: DDS (Data Distribution Service) over UDP/TCP
- Security: SROS 2 (X.509 certificates, governance/permissions XML)
- Latency: ~1-5ms (suitable for real-time feedback)
- Use case: Production robot fleets, warehouse automation, campus logistics

**Security model:**

- Per-workspace CA (stored in Vault)
- Per-robot identity certificates
- Topic-level access control via `permissions.xml`
- Fail-closed: expired certificates block all communication

**When to use:**

- Production robot deployments
- Environments requiring DDS-level topic access control
- Multi-robot fleets needing participant authentication

### Tier 3: MQTT -- Constrained Devices and IoT

```
┌───────────┐   gRPC     ┌────────────────┐  MQTT    ┌──────────┐
│ Portarium │◄───────────►│  MQTT Bridge   │◄────────►│  IoT     │
│ Control   │  (mTLS)    │  Node          │  (TLS)   │  Devices │
│ Plane     │            └────────────────┘          └──────────┘
                                   │
                                   ▼
                          ┌────────────────┐
                          │  MQTT Broker   │
                          │  (Mosquitto/   │
                          │   EMQX)        │
                          └────────────────┘
```

**Characteristics:**

- Transport: MQTT 5.0 over TCP/TLS
- Encoding: JSON or CBOR (compact binary)
- Security: TLS + MQTT username/password or X.509 client certificates
- Latency: ~5-50ms (depends on QoS level)
- Bandwidth: Low (suitable for constrained networks)
- Use case: IoT sensors, PLCs, low-power edge devices, industrial gateways

**When to use:**

- Battery-powered or bandwidth-constrained devices
- Industrial environments with OPC UA/MQTT gateways
- Devices that cannot run a full ROS 2 stack

## Topic ACL Model for MQTT

MQTT topic access control maps Portarium's workspace-scoped governance to MQTT topic
namespaces.

### Topic Namespace Convention

```
portarium/{workspaceId}/telemetry/{deviceId}/{telemetryType}
portarium/{workspaceId}/commands/{deviceId}
portarium/{workspaceId}/acks/{deviceId}
portarium/{workspaceId}/events/{deviceId}
```

### ACL Rules

| Role               | Topic Pattern                          | Access              |
| ------------------ | -------------------------------------- | ------------------- |
| Device (publish)   | `portarium/{wsId}/telemetry/{ownId}/#` | Publish             |
| Device (subscribe) | `portarium/{wsId}/commands/{ownId}`    | Subscribe           |
| Device (publish)   | `portarium/{wsId}/acks/{ownId}`        | Publish             |
| Bridge (subscribe) | `portarium/{wsId}/telemetry/#`         | Subscribe           |
| Bridge (publish)   | `portarium/{wsId}/commands/#`          | Publish             |
| Bridge (subscribe) | `portarium/{wsId}/acks/#`              | Subscribe           |
| Admin (all)        | `portarium/{wsId}/#`                   | Publish + Subscribe |

### ACL Enforcement

- **Mosquitto:** ACL file generated per workspace from Portarium device registry
- **EMQX:** HTTP ACL plugin calls Portarium API for real-time authorization
- **ACL refresh:** On device registration/deregistration events
- **Deny-by-default:** Unmatched topics are rejected

### QoS Mapping

| Portarium priority | MQTT QoS              | Behaviour                             |
| ------------------ | --------------------- | ------------------------------------- |
| Critical (safety)  | QoS 2 (exactly once)  | Guaranteed delivery, highest overhead |
| Normal (telemetry) | QoS 1 (at least once) | Reliable delivery, allows duplicates  |
| Low (diagnostics)  | QoS 0 (at most once)  | Best effort, lowest overhead          |

## Bridge Node Lifecycle

All bridge node types follow the same lifecycle:

1. **Registration:** `portarium agent register --type {ros2-bridge|mqtt-bridge}` creates
   the bridge identity in the workspace agent registry
2. **Certificate provisioning:** Bridge retrieves identity certificate from Vault
3. **Connection:** Bridge establishes gRPC connection to Portarium control plane and
   local transport connection (DDS/MQTT/WebSocket)
4. **Heartbeat:** Bridge sends periodic heartbeats to control plane
5. **Operation:** Bridge translates between local transport and Portarium gRPC
6. **Rotation:** Bridge renews certificates before expiry
7. **Shutdown:** Bridge sends deregistration signal on graceful shutdown

## Selection Guide

| Factor         | rosbridge (Tier 1)  | DDS/SROS 2 (Tier 2) | MQTT (Tier 3)   |
| -------------- | ------------------- | ------------------- | --------------- |
| Latency        | ~10-50ms            | ~1-5ms              | ~5-50ms         |
| Security       | TLS only            | DDS-level PKI       | TLS + ACL       |
| Device cost    | Any (dev laptop)    | Medium-high         | Low             |
| Bandwidth      | High                | High                | Low             |
| ROS 2 required | Yes (via rosbridge) | Yes                 | No              |
| Production use | No                  | Yes                 | Yes             |
| Governance     | Basic               | Full (topic ACL)    | Full (MQTT ACL) |
