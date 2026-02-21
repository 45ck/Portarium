# ADR-0066: Robotics Integration Architecture Boundary

## Status

Accepted

## Context

Portarium needs a clear robotics integration boundary so workflow automation can safely include robot actions without taking ownership of real-time control loops or local safety enforcement.

Without an explicit split, control-plane policy and approval logic can leak into latency-sensitive edge execution paths, and edge-specific protocol concerns can leak back into the domain model.

## Decision

Portarium uses a three-layer architecture for robotics integrations:

1. Control and decision plane (Portarium control plane)
2. Execution plane (Portarium workers and adapters)
3. Edge robot gateway (robotics middleware / PLC-facing runtime)

Portarium issues high-level mission goals and policy-gated intents only. Servo loops, emergency stop handling, and local interlocks remain at the edge gateway.

### Layer responsibilities

- Control and decision plane:
  - policy evaluation, SoD, approvals, evidence, audit, tenancy boundaries
  - records command intent and outcome evidence
- Execution plane:
  - invokes registered mission adapters with containment and retries
  - normalizes telemetry/events into Portarium contracts
- Edge robot gateway:
  - translates mission intent into robot-native commands
  - enforces local safety interlocks and real-time constraints
  - owns protocol/session behavior against robot networks

### Protocol selection by integration class

- gRPC: default general-purpose gateway protocol for typed command/response APIs
- ROS 2 Action bridge: robot-native mission execution in ROS-based fleets
- MQTT: IoT/PLC-style command and telemetry transport
- OPC UA: industrial control and plant integration

### Architecture diagram

```mermaid
flowchart LR
  subgraph CP[Portarium Control Plane]
    P[Policy + SoD]
    A[Approvals]
    E[Evidence + Audit]
  end

  subgraph EP[Portarium Execution Plane]
    W[Workflow Worker]
    AD[Mission Adapter]
  end

  subgraph EG[Edge Robot Gateway]
    G[Gateway Runtime]
    S[Safety Interlocks / E-Stop]
    R[Robot / PLC Middleware]
  end

  P --> W
  A --> W
  W --> AD
  AD --> G
  G --> R
  S --> G
  G --> E
```

## Consequences

- Keeps safety-critical control local to the edge while retaining policy and evidence integrity in Portarium.
- Enables multiple robotics protocol adapters without changing core workflow/policy semantics.
- Establishes stable boundaries for mission APIs, telemetry normalization, and governance controls.

## Implementation Mapping

The architecture boundary in this ADR is implemented and verified across the following beads:

- `bead-0505`: mission dispatch/cancel/status boundary contract and adapter-facing integration shape.
- `bead-0507`: robotics capability matrix contract for boundary-level protocol declarations.
- `bead-0508`: mission aggregate/domain model contract for control-plane intent semantics.
- `bead-0509`: robot and fleet domain contracts for execution/edge separation.
- `bead-0510`: safety-state domain contracts for explicit local safety ownership boundaries.
- `bead-0511`: robotics event contract normalization for control-plane evidence/audit ingestion.
- `bead-0512`: orchestration and run-policy integration for robotics mission execution boundaries.
- `bead-0513`: architecture/spec alignment for robotics action semantics and control-plane ownership.
- `bead-0514`: conformance hardening and boundary test coverage closure for robotics contracts.

Protocol-specific gateway adapter implementation remains tracked as follow-on work:

- `bead-0515` (gRPC edge gateway prototype)
- `bead-0516` (MQTT gateway prototype)
- `bead-0517` (ROS 2 Action bridge prototype)
- `bead-0518` (OPC UA gateway prototype)

## Acceptance Evidence

- `src/application/ports/mission-port.ts`
- `src/domain/ports/port-family-capabilities-v1.ts`
- `src/domain/robots/mission-v1.ts`
- `src/domain/robots/robot-fleet-v1.ts`
- `src/domain/event-stream/robot-events-v1.ts`
- `.specify/specs/robotics-action-semantics.md`

## Review Linkage

- `bead-0622`: implementation mapping closure review
- `docs/review/bead-0622-adr-0066-implementation-mapping-review.md`
- `bead-0623`: mapping/linkage verification review
- `docs/review/bead-0623-adr-0066-linkage-review.md`

## References

- `bead-0497` Domain Atlas robotics taxonomy
- `bead-0505` ADR implementation bead
