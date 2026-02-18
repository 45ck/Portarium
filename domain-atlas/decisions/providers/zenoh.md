# zenoh

- Provider ID: `zenoh`
- Port Families: `RoboticsActuation`
- Upstream: `https://github.com/eclipse-zenoh/zenoh`
- Pinned commit: `ccbf047725f144373398735897830f015147bfac`
- License: EPL-2.0 (`study_only`)

## What This Is

Eclipse Zenoh is a next-generation pub/sub, queryable storage, and compute protocol designed for low-latency edge and cloud scenarios. It operates as a superset of DDS with:

- **Pub/sub** via `put()` / `declare_subscriber()` on KeyExpressions
- **Queryable storage** via `get()` / `declare_queryable()` — enables request/reply and historical data access
- **Peer-to-peer** and routed transport modes (no broker required for local networks)
- **Wildcard routing**: `robots/**` subscribes to all robots simultaneously
- **Zenoh-ROS2 bridge** (`zenoh-plugin-ros2dds`): transparently bridges ROS 2 DDS topics over Zenoh

Key primitives modelled:

- `KeyExpr` — hierarchical resource name with wildcard support
- `Sample` — the data unit (payload + metadata + SampleKind: Put/Delete)
- `Publisher` / `Subscriber` — declared pub/sub channels
- `Query` / `Reply` — get/queryable request-reply pattern
- `Session` — top-level connection handle (peer ZenohId)

## Why Selected

Zenoh is the emerging standard for robotics cloud-edge data distribution, adopted by ROS 2 (as the `rmw_zenoh` middleware alternative to DDS) and embedded robot platforms. It offers sub-millisecond latency, scales from microcontrollers to cloud, and unifies telemetry + storage + compute in one protocol.

**Scoring**: Priority 6 — future-facing alternative/complement to rosbridge for Portarium's execution plane.

## License Note

EPL-2.0 is `study_only` — Portarium must connect to Zenoh as a client (via the Zenoh Rust/Python/TypeScript bindings) without bundling Zenoh router code. The `zenoh` npm package (TypeScript bindings) uses Apache-2.0 and is `safe_to_reuse`.

## Mapping Notes (Canonical)

- `Session` → `Asset` (robot peer in the Zenoh network, identified by ZenohId).
- `Query` → `Task` (when used as a mission command to a queryable robot controller).
- `Publisher` → `Task` (command publisher declared to issue actuation messages).
- `KeyExpr` → `ExternalObjectRef` (resource address; referenced in task parameters and cockpit filters).
- `Sample` → `ExternalObjectRef` (telemetry sample; cockpit streaming panels).
- `Reply` → `ExternalObjectRef` (query response evidence linked from Task).
- `Subscriber` → `ExternalObjectRef` (active subscription inventory ref linked from Asset).

## Capability Matrix Notes

- Subscriber declarations and get() queries are `Auto` tier (read-only).
- put() to motion keyspaces (e.g., `robots/<id>/cmd`) is `HumanApprove`.
- Wildcard fleet subscriptions (`robots/**`) enable single-subscription fleet telemetry aggregation.
- No application-level idempotency key; Zenoh timestamps (HLC) provide ordering but not deduplication.
- Zenoh attachments allow Portarium to inject trace IDs as opaque bytes without schema changes.

## Open Questions

- Should Portarium use `zenoh-plugin-ros2dds` to bridge existing ROS 2 robots via Zenoh transparently?
- Zenoh queryables as a command interface — can robot controllers expose a queryable that accepts mission goals?
- Does Portarium deploy a Zenoh router in its cloud control plane, or use peer-to-peer mode for direct robot sessions?
