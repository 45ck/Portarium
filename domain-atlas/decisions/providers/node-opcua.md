# node-opcua

- Provider ID: `node-opcua`
- Port Families: `RoboticsActuation`
- Upstream: `https://github.com/node-opcua/node-opcua`
- Pinned commit: `ab3bd98e69a7d365a40094d35122c4e879d04460`
- License: MIT (`safe_to_reuse`)

## What This Is

node-opcua is a pure-JavaScript/TypeScript implementation of the OPC UA stack. OPC UA (IEC 62541) is the dominant industrial automation protocol for PLCs, CNCs, robotic arms, and manufacturing equipment. Key capabilities modelled:

- **Information Model**: Address space with Nodes, NodeIds, NodeClass hierarchy (Object, Variable, Method, ObjectType, VariableType)
- **Services**: Read, Write, Browse, CallMethod, CreateSubscription, CreateMonitoredItems
- **Real-time**: DataChangeNotifications and EventNotifications via OPC UA Subscriptions (Publish service)
- **Security**: OPC UA security modes (None, Sign, SignAndEncrypt) with X.509 certificates

In the Portarium robotics stack, node-opcua enables connectivity to:

- Industrial robotic arms (KUKA, ABB, FANUC via OPC UA companion specifications)
- PLCs (Siemens, Beckhoff, B&R via OPC UA server)
- SCADA systems exposing OPC UA endpoints
- Collaborative robot (cobot) controllers

## Why Selected

OPC UA is the IEC/ISO standard for industrial device interoperability. Any Portarium deployment integrating with factory-floor robots or PLCs requires OPC UA. node-opcua is the leading OSS OPC UA client for Node.js/TypeScript environments — matches Portarium's runtime.

**Scoring**: Priority 4 — essential for industrial/manufacturing robotics verticals.

## Mapping Notes (Canonical)

- `Subscription` → `Asset` (active monitoring channel, lifecycle-managed).
- `WriteValue` → `Task` (actuation task; writes PLC register or robot parameter; `HumanApprove`).
- `NodeId` → `ExternalObjectRef` (address-space pointer; referenced from task parameters).
- `DataValue` → `ExternalObjectRef` (telemetry reading; cockpit sensor panels).
- `BrowseResult` → `ExternalObjectRef` (discovery artefact; address-space navigation).
- `MonitoredItemCreateRequest` → `ExternalObjectRef` (monitoring configuration linked from Subscription Asset).

## Capability Matrix Notes

- Browse and Read are `Auto` tier (safe, idempotent, read-only).
- Write and CallMethod are `HumanApprove` — may directly actuate hardware (motor, valve, conveyor).
- Subscription management is `Assisted` with rollback via deleteSubscription.
- No idempotency key; OPC UA Write is at-most-once at the protocol layer.
- Verified effects: re-read the attribute immediately after write to confirm new value.

## Open Questions

- OPC UA companion specifications (robotics CS, PackML, etc.) — should Portarium model these as separate providers or extensions of node-opcua?
- Historical access (OPC UA HistoricalRead) — needed for audit log extraction? (Not in scope for v1.)
