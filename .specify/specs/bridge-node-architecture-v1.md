# Bridge Node Architecture Contract v1

**Beads:** bead-0650 (bead-0689 original reference)

## Purpose

Define the three-tier bridge node architecture for connecting edge devices to the
Portarium control plane, including transport selection, security models, and MQTT
topic ACL governance.

## Scope

- Three transport tiers: rosbridge (WebSocket), DDS-Security (SROS 2), MQTT
- MQTT topic namespace convention and ACL model
- Bridge node lifecycle (registration through shutdown)
- Transport selection criteria

## Transport Tiers

### Tier 1: rosbridge (WebSocket)

- Development and simulation only
- JSON over WebSocket
- No DDS-level security
- Use case: dev workstations, CI, demos

### Tier 2: DDS-Security (SROS 2)

- Production robot networks
- X.509 certificates, topic-level access control
- Low latency (~1-5ms)
- Use case: robot fleets, warehouse automation

### Tier 3: MQTT

- Constrained devices and IoT
- MQTT 5.0 over TLS with topic ACL
- Low bandwidth suitable for battery-powered devices
- Use case: IoT sensors, PLCs, industrial gateways

## MQTT Topic ACL Contract

### Namespace

```
portarium/{workspaceId}/telemetry/{deviceId}/{telemetryType}
portarium/{workspaceId}/commands/{deviceId}
portarium/{workspaceId}/acks/{deviceId}
portarium/{workspaceId}/events/{deviceId}
```

### ACL enforcement

- Deny-by-default: unmatched topics rejected
- Device can only publish to its own telemetry/ack topics
- Device can only subscribe to its own command topic
- Bridge has workspace-wide access
- ACL refresh on device registration/deregistration

## Bridge Lifecycle Contract

1. Register via `portarium agent register --type {type}`
2. Retrieve certificate from Vault
3. Establish gRPC + local transport connections
4. Heartbeat loop
5. Translate messages bidirectionally
6. Auto-rotate certificates
7. Deregister on shutdown

## Acceptance Criteria

1. Architecture document published at `docs/integration-catalog/bridge-node-architecture.md`
2. Three transport tiers documented with selection criteria
3. MQTT topic ACL model defined with deny-by-default
4. Bridge lifecycle documented (registration through shutdown)
5. QoS mapping defined for MQTT priority levels
