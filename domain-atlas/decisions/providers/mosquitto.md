# mosquitto

- Provider ID: `mosquitto`
- Port Families: `RoboticsActuation`
- Upstream: `https://github.com/eclipse-mosquitto/mosquitto`
- Pinned commit: `66486e47485412ec5d6d2c7a4466b2bf9405462f`
- License: EPL-2.0 (`study_only`)

## What This Is

Eclipse Mosquitto is a lightweight MQTT broker implementing MQTT 3.1, 3.1.1, and 5.0. In robotics it serves as the message bus for IoT sensor data, telemetry, and command dispatch — especially in constrained embedded environments and edge deployments where ROS 2 DDS is too heavy.

Key roles in the robotics stack:

- **Telemetry aggregation**: sensors publish battery level, GPS, temperatures to `robots/<id>/telemetry/#`
- **Command dispatch**: fleet management publishes mission commands to `robots/<id>/commands/#`
- **Alert relay**: fault detection systems publish to `robots/<id>/alerts/#`
- **Bridge**: Mosquitto sits between cloud and on-robot MQTT clients (often bridged to ROS 2 via `mqtt_bridge`)

## Why Selected

MQTT + Mosquitto is the dominant IoT/robotics messaging pattern for constrained devices, cloud bridges, and multi-vendor fleet scenarios. Many commercial robot platforms (Boston Dynamics, Clearpath, custom AGVs) expose a Mosquitto-compatible interface.

**Scoring**: Priority 2 — lightweight, ubiquitous, complements ROS 2 DDS for cloud-edge bridging.

## License Note

EPL-2.0 is `study_only` — the CIF and adapter must not bundle Mosquitto code directly. Portarium connects via the libmosquitto client library (separate EPL-2.0 artefact) or MQTT protocol over TCP/WebSocket.

## Mapping Notes (Canonical)

- `MqttSession` → `Asset` (robot device connection, tracked by clientId).
- `MqttMessage` (command topics) → `Task` (fire-and-forget actuation task).
- `MqttSubscription` → `ExternalObjectRef` (telemetry channel inventory).
- `MqttBrokerConfig` → `ExternalObjectRef` (infrastructure configuration record).

## Capability Matrix Notes

- Topic subscriptions are `Auto` tier (read-only telemetry).
- Command publishes are `HumanApprove` — topic-specific; motion commands are highest risk.
- No application-level idempotency key; QoS 2 gives exactly-once transport delivery.

## Open Questions

- Should Portarium broker its own Mosquitto instance as part of the execution plane, or connect to customer-managed brokers?
- MQTT 5 user-properties as a structured payload schema for Portarium metadata — feasible?
