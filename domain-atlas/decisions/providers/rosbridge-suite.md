# rosbridge-suite

- Provider ID: `rosbridge-suite`
- Port Families: `RoboticsActuation`
- Upstream: `https://github.com/RobotWebTools/rosbridge_suite`
- Pinned commit: `9c7064176d61414f20e26fba879cec7dc544971d`
- License: BSD-3-Clause (`safe_to_reuse`)

## What This Is

rosbridge_suite implements the rosbridge v2.0 protocol — a WebSocket/JSON bridge that exposes the full ROS 2 pub/sub/service/action interface to non-ROS clients. The server runs on the robot (or edge gateway) and translates JSON WebSocket messages into native ROS 2 calls.

Key operations modelled:

- `subscribe` / `unsubscribe` — receive topic streams
- `publish` / `advertise` / `unadvertise` — send topic messages
- `call_service` / `service_response` — synchronous ROS 2 service calls
- `fragment` — large-payload fragmentation and reassembly
- `set_level` / `status` — diagnostic verbosity and server status

## Why Selected

rosbridge is the standard Web→ROS 2 bridge. It is how Portarium's cloud-side adapter layer talks to robots without requiring a native ROS 2 node in the Portarium deployment. The Portarium `RoboticsActuation` adapter uses rosbridge over WSS as Layer 2 of the three-layer architecture.

**Scoring**: Priority 5 — the primary transport bridge for Portarium's execution plane.

## Mapping Notes (Canonical)

- `ServiceCallRequest` → `Task` (synchronous ROS 2 service call as a Portarium workflow step).
- `PublishRequest` (command topics) → `Task` (fire-and-forget command task; `HumanApprove` for motion topics).
- `SubscribeRequest` → `ExternalObjectRef` (active subscription channel; links to robot telemetry streams).
- `TopicMessage` → `ExternalObjectRef` (individual received messages; cockpit telemetry panels).
- `ServiceResponse` → `ExternalObjectRef` (completion evidence linked from Task).
- `FragmentMessage` → `ExternalObjectRef` (transport-layer artefact; only relevant for large payload audit).

## Capability Matrix Notes

- Topic subscriptions are `Auto` tier (read-only).
- Command publishes to motion/control topics are `HumanApprove`.
- Service calls are `HumanApprove` (service-specific side effects).
- Action goals (wrapped as service calls) support rollback via `cancel_goal` service call.
- Streaming via WebSocket; no polling required.

## Open Questions

- CBOR compression support — should the Portarium adapter use `compression: "cbor"` for high-frequency telemetry topics?
- Authentication: rosbridge v2 has no built-in auth; Portarium should mandate a WSS reverse proxy (nginx/Envoy) with JWT validation.
- Should Portarium use rosbridge or ZENOH as the primary bridge? (Zenoh offers lower latency; rosbridge offers simpler adoption.)
