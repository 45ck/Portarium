# Domain Atlas: Robotics & Physical Actuation — Taxonomy

> Version 1.0 · 2026-02-18 · bead-0497

This document forms the foundational atlas layer for the **RoboticsActuation** port family. It defines the robot class taxonomy, integration pattern catalogue, protocol inventory, and the scoring rubric used to evaluate open-source projects in `project-inventory.md`.

---

## 1. Robot Class Taxonomy

Portarium treats every physical device as an **Asset** in the domain, further discriminated by `robotClass`. The taxonomy below maps to the ISO 8373 "Manipulating Robots" vocabulary where applicable, extended for autonomous mobile and cyber-physical systems.

| Class                                              | Identifier    | Description                                                                                                                | Typical Comms                      | Safety Standard                           |
| -------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| Autonomous Mobile Robot / Automated Guided Vehicle | `AMR` / `AGV` | Wheeled or tracked platform navigating floors autonomously or along fixed paths; warehouse fulfillment, hospital logistics | ROS 2 / DDS, MQTT, gRPC            | ISO 3691-4, ISO 10218-2                   |
| Manipulator Arm                                    | `MANIPULATOR` | Fixed-base or rail-mounted articulated arm; pick-and-place, welding, assembly                                              | ROS 2 / ros2_control, OPC UA, gRPC | ISO 10218-1, ISO/TS 15066 (collaborative) |
| Aerial / UAV                                       | `UAV`         | Multi-rotor or fixed-wing UAS; inspection, surveying, delivery                                                             | MAVLink, ROS 2, MQTT               | ISO 21384, EASA regulations               |
| Fixed PLC / CNC / Actuator                         | `PLC`         | Stationary industrial controller or machine axis; conveyor, valve, pump, CNC spindle                                       | OPC UA, Modbus, MQTT               | IEC 62443, ISO 13849-1                    |
| Humanoid / Bipedal (future)                        | `HUMANOID`    | Full-body humanoid platform; research, future commercial deployments                                                       | ROS 2, proprietary gRPC APIs       | ISO 10218 (in development)                |

### Asset discriminant fields (extends Portarium `Asset`)

```typescript
interface RobotAsset extends Asset {
  robotClass: 'AMR' | 'AGV' | 'MANIPULATOR' | 'UAV' | 'PLC' | 'HUMANOID';
  manufacturer: string; // e.g. "Boston Dynamics", "Universal Robots"
  modelName: string; // e.g. "Spot", "UR10e"
  serialNumber: string; // per-unit identity
  firmwareVersion: string;
  gatewayId: RobotGatewayId; // edge gateway managing this device
  fleetId?: FleetId; // optional fleet membership
  safetyProfile: SafetyProfileRef;
}
```

---

## 2. Integration Pattern Catalogue

Portarium's architecture uses a **three-layer model** when controlling physical systems. The boundary between layers is the most critical design decision — it determines where safety-critical logic runs and where Portarium's Workflow engine sits.

### 2.1 Layer Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1 — Portarium Control Plane                              │
│  Mission planning, approval workflows, SoD enforcement,         │
│  evidence capture, human-in-the-loop gates                      │
│  Communicates via: gRPC/HTTP to Layer 2                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ MissionCommand / ActionRequest
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2 — Portarium Execution Plane (RoboticsActuation port)   │
│  Action dispatch, telemetry ingestion, safety constraint eval,  │
│  capability matrix enforcement                                  │
│  Communicates via: MQTT/gRPC/OPC UA to Layer 3                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Low-latency command / sensor data
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3 — Edge Robot Gateway                                   │
│  ROS 2 / Nav2 / ros2_control / MoveIt 2 execution               │
│  Hardware abstraction, real-time control loops                  │
│  Never network-reachable directly from Layer 1                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Control Boundary Patterns

#### Pattern A — Mission-Level Control (recommended for AMR/Fleet)

Portarium issues high-level `Mission` commands (navigate to waypoint, execute task sequence). Layer 3 handles all real-time path execution. Portarium never issues velocity commands directly.

**Use when**: autonomous navigation, warehouse AMR fleets, multi-step inspection tasks.

**Evidence produced**: `MissionStarted`, `MissionCompleted`, `MissionAborted` events captured as `EvidenceEntry`.

#### Pattern B — Action-Level Control (manipulators, PLCs)

Portarium dispatches discrete actions (`actuator:set_state`, `robot:execute_action`) with named parameters. The edge gateway translates to hardware-specific signals.

**Use when**: pick-and-place, valve open/close, conveyor start/stop, CNC program execution.

**Safety rule**: every action above threshold (force, velocity, reach) must pass `SafetyConstraint` evaluation before dispatch.

#### Pattern C — Telemetry-Only / Shadow Mode

Portarium ingests telemetry and sensor streams without issuing commands. Used for audit, compliance baselining, or before trust is established.

**Use when**: initial integration, regulatory observation period, post-incident analysis.

### 2.3 Mission-Level vs Servo-Level Boundary

| Concern                  | Portarium side   | Edge gateway side   |
| ------------------------ | ---------------- | ------------------- |
| Mission sequencing       | ✓                |                     |
| Approval gates           | ✓                |                     |
| Evidence capture         | ✓                |                     |
| Operator e-stop (UI)     | ✓ (request)      | ✓ (execution)       |
| Safety constraint policy | ✓ (policy store) | ✓ (hard interrupt)  |
| Path planning            |                  | ✓ (Nav2 / MoveIt 2) |
| Joint trajectory control |                  | ✓ (ros2_control)    |
| Real-time velocity loop  |                  | ✓ (hardware layer)  |
| Sensor fusion            |                  | ✓                   |

**Invariant**: Portarium MUST NOT be on the hard real-time control path. Commands from Portarium have bounded-latency requirements measured in seconds, not milliseconds.

---

## 3. Protocol Inventory

### 3.1 ROS 2 / DDS

| Attribute      | Detail                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| Transport      | UDP (DDS), configurable reliable/best-effort QoS                           |
| Discovery      | DDS participant discovery (UDP multicast or FastDDS Discovery Server)      |
| Message format | IDL → serialised via CDR; rosbridge uses JSON                              |
| Security       | SROS2: DDS-Security (DH key exchange, AES-128-GCM, signed permissions XML) |
| Latency        | Sub-millisecond on LAN; unacceptable over WAN — requires bridge            |
| WAN bridging   | `rosbridge_suite` (WebSocket/JSON) or `zenoh-bridge-ros2dds` (QUIC)        |
| Licence        | Apache 2.0 (ROS 2 core)                                                    |
| Best fit       | AMR fleets, manipulators, UAVs with ROS 2 firmware                         |

**Integration note**: Portarium's execution plane adapter connects to `rosbridge_suite` or a Zenoh bridge, not to DDS directly. This keeps Layer 1/2 outside the DDS domain.

### 3.2 MQTT (Eclipse Mosquitto / EMQX)

| Attribute        | Detail                                                       |
| ---------------- | ------------------------------------------------------------ |
| Transport        | TCP/TLS; MQTT 5.0 preferred for request/response correlation |
| QoS              | 0 (fire-and-forget), 1 (at-least-once), 2 (exactly-once)     |
| Topic convention | `portarium/{tenantId}/robot/{robotId}/cmd` / `.../telemetry` |
| Security         | TLS 1.3 + client certificates; ACL per robotId / tenantId    |
| Latency          | 10–100 ms WAN; suitable for command dispatch and telemetry   |
| Licence          | EPL 2.0 / EDL 1.0 (Mosquitto); Apache 2.0 (EMQX)             |
| Best fit         | PLCs, IoT actuators, mixed fleets, telemetry fan-out         |

**Integration note**: Portarium execution plane publishes to command topics; subscribes to telemetry and event topics. MQTT broker is tenancy-scoped.

### 3.3 gRPC

| Attribute | Detail                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------- |
| Transport | HTTP/2 + TLS; bidirectional streaming for telemetry                                            |
| IDL       | Protocol Buffers v3                                                                            |
| Security  | mTLS (SPIFFE/SPIRE recommended); application-layer JWT                                         |
| Latency   | 5–50 ms WAN; well-suited for structured command/response                                       |
| Licence   | Apache 2.0                                                                                     |
| Best fit  | Purpose-built robot APIs (Boston Dynamics Spot SDK, Intrinsic Flowstate), cloud robot gateways |

**Integration note**: gRPC is the preferred transport for vendors providing a structured SDK. Portarium wraps vendor gRPC stubs inside the `RoboticsActuationPort` adapter boundary.

### 3.4 OPC UA

| Attribute         | Detail                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------- |
| Transport         | TCP binary (`opc.tcp://`); optional HTTPS-UA                                            |
| Information model | Hierarchical address space; standard + companion specs (Robotics OPC UA Companion Spec) |
| Security          | Certificate-based; SecurityPolicy: `Basic256Sha256` minimum                             |
| Latency           | 10–100 ms; not real-time but deterministic at human-scale                               |
| Licence           | Royalty-free IEC 62541 standard; `node-opcua` (MIT)                                     |
| Best fit          | Industrial PLCs, CNC machines, factory automation (Siemens, Beckhoff, B&R, Kuka)        |

**Integration note**: OPC UA exposes a static address space that Portarium reads at connection time to build a capability matrix. Write nodes map to `actuator:set_state` operations.

### 3.5 WebSockets

| Attribute         | Detail                                                       |
| ----------------- | ------------------------------------------------------------ |
| Transport         | HTTP upgrade; full-duplex TCP                                |
| Usage in robotics | `rosbridge_suite` primary transport; vendor web dashboards   |
| Security          | WSS (TLS 1.3); token auth in upgrade request                 |
| Latency           | 20–200 ms; acceptable for telemetry display, not for control |
| Best fit          | Rosbridge ROS 2 bridging; dashboards; simulated environments |

### 3.6 Zenoh

| Attribute | Detail                                                         |
| --------- | -------------------------------------------------------------- |
| Transport | QUIC, TCP, UDP; peer-to-peer or routed                         |
| Usage     | DDS-Zenoh bridge for ROS 2 WAN extension; native IoT messaging |
| Security  | TLS + configurable access control                              |
| Latency   | Sub-10 ms on LAN; better WAN characteristics than DDS          |
| Licence   | EPL 2.0 / Apache 2.0                                           |
| Best fit  | Multi-site ROS 2 deployments, edge-to-cloud telemetry          |

### 3.7 Protocol Selection Decision Tree

```
Is the device ROS 2 native?
  ├─ Yes, LAN only → DDS direct via rosbridge adapter
  ├─ Yes, WAN → Zenoh bridge → gRPC/MQTT to Portarium
  └─ No
      ├─ Industrial PLC / CNC? → OPC UA
      ├─ Vendor SDK available? → gRPC (wrap SDK)
      ├─ Simple IoT / mixed fleet? → MQTT
      └─ Browser / sim only? → WebSockets
```

---

## 4. Scoring Rubric

Used to evaluate open-source projects for adoption into the Portarium robotics integration stack.

| Criterion             | Weight   | Description                                                                                                        |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| Control-plane fit     | 15%      | Does it integrate cleanly with Portarium's mission/action model? Provides structured APIs, not just raw protocols. |
| Security posture      | 15%      | TLS/mTLS support, authentication, authorisation, audit logging, known CVE history.                                 |
| Safety relevance      | 10%      | Supports safety-critical modes: e-stop, watchdog, fault isolation. ISO-aligned if applicable.                      |
| Interoperability      | 10%      | Standards compliance (ROS 2, OPC UA, MQTT), multi-vendor support, no proprietary lock-in.                          |
| Real-time suitability | 10%      | Latency guarantees, QoS controls, deterministic behaviour under load.                                              |
| Community health      | 10%      | GitHub stars, commit frequency (last 90 days), number of maintainers, response time on issues.                     |
| Licence clarity       | 10%      | OSI-approved licence; no CLA or commercial restrictions that block SaaS distribution.                              |
| Documentation quality | 8%       | API reference completeness, getting-started guides, example code, architecture docs.                               |
| Edge readiness        | 8%       | Can run on constrained hardware (ARM64, 4 GB RAM); Dockerized; minimal dependencies.                               |
| Observability         | 4%       | OpenTelemetry support, structured logging, metrics endpoints.                                                      |
| **Total**             | **100%** |                                                                                                                    |

### Score bands

| Band            | Range  | Recommendation                                        |
| --------------- | ------ | ----------------------------------------------------- |
| Tier 1 — Adopt  | 80–100 | Proceed to prototype; prioritise in roadmap           |
| Tier 2 — Trial  | 60–79  | Prototype with caution; evaluate specific gaps        |
| Tier 3 — Assess | 40–59  | Research only; do not build production dependency yet |
| Tier 4 — Hold   | < 40   | Not suitable for Portarium integration at this time   |

---

## 5. Capability String Convention

The `RoboticsActuation` port family uses the same `entity:operation` capability string convention as all Portarium port families.

| Capability               | Description                                                               |
| ------------------------ | ------------------------------------------------------------------------- |
| `robot:execute_action`   | Dispatch a named action to a robot (navigate, pick, inspect)              |
| `robot:cancel_action`    | Cancel a running action by actionId                                       |
| `robot:stop`             | Graceful stop — complete current trajectory then halt                     |
| `robot:estop_request`    | Emergency stop request — immediate halt, triggers safety interlock        |
| `robot:get_state`        | Read current robot state (pose, velocity, battery, mode)                  |
| `robot:get_diagnostics`  | Read diagnostic data (joint health, sensor status, error codes)           |
| `actuator:set_state`     | Set actuator to target state (valve open/close, conveyor speed, PLC coil) |
| `actuator:get_state`     | Read current actuator state                                               |
| `fleet:dispatch_mission` | Assign a Mission to an available robot in the fleet                       |
| `fleet:get_status`       | Get current status of all robots in fleet                                 |
| `telemetry:subscribe`    | Subscribe to a telemetry stream (position, sensor, video)                 |
| `telemetry:get_snapshot` | Get a point-in-time telemetry snapshot                                    |

---

## 6. ADR Cross-References

| ADR                                              | Relevance                                            |
| ------------------------------------------------ | ---------------------------------------------------- |
| ADR-0035 — Domain Atlas Research Pipeline        | This document follows the atlas pipeline pattern     |
| ADR-0026 — Port Taxonomy                         | `RoboticsActuation` is port family #19               |
| ADR-0032 — CloudEvents                           | All robot domain events follow CloudEvents 1.0       |
| ADR-0034 — Untrusted Execution Containment       | Edge gateway runs as an untrusted execution surface  |
| ADR-0056 — Infrastructure Reference Architecture | Layer 3 sits in the Execution Plane from ADR-0056    |
| bead-0505 — Robotics Architecture ADR            | Full architectural decision pending; links back here |
| bead-0506 — Safety Boundary ADR                  | Safety constraint model; links back here             |
