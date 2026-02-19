# ADR-0067: Robotics Safety Boundary and Ownership Model

## Status

Accepted

## Context

Portarium orchestrates mission intent and policy for robot actions, but it is not a real-time safety controller. Safety-critical control functions must be owned by the edge runtime closest to actuators and sensors.

Without an explicit boundary, system design can incorrectly place collision and emergency controls in non-real-time control-plane code paths.

## Decision

Portarium and edge safety controllers have distinct ownership:

- Portarium governs policy, approval, orchestration, and evidence.
- Edge safety controller governs real-time protective controls and immediate hazard response.

### Ownership split

Portarium owns:

- execution-tier and policy gating (`Auto`, `Assisted`, `HumanApprove`, `ManualOnly`)
- approval and SoD enforcement for mission intent
- mission scheduling and non-real-time retries
- idempotency and deduplication controls
- immutable evidence and audit chain

Edge safety controller owns:

- emergency stop behavior (`E-stop`) and reset semantics
- safety interlocks and permissive chains
- collision avoidance and speed/zone enforcement
- hard geofence limits and keep-out zones
- real-time closed-loop motion control

## RACI

| Function                                      | Portarium Control Plane | Execution Plane | Edge Safety Controller | Site Safety/Controls Engineer |
| --------------------------------------------- | ----------------------- | --------------- | ---------------------- | ----------------------------- |
| Policy tier gating and approvals              | A/R                     | C               | I                      | C                             |
| Mission dispatch orchestration                | A/R                     | R               | C                      | I                             |
| Idempotency/retry strategy                    | A/R                     | R               | I                      | I                             |
| E-stop trigger and latching                   | I                       | I               | A/R                    | C                             |
| Collision avoidance and speed limits          | I                       | I               | A/R                    | C                             |
| Geofence enforcement in real-time motion loop | I                       | I               | A/R                    | C                             |
| Evidence/audit for command intent and outcome | A/R                     | R               | C                      | I                             |
| Incident forensics and reconstruction         | A/R                     | R               | C                      | C                             |

Legend: `R` = Responsible, `A` = Accountable, `C` = Consulted, `I` = Informed.

## Safety and security interaction

- Safety commands (`robot:stop`, `robot:estop_request`) may be policy-prioritized by Portarium but final authority and timing remain at the edge safety controller.
- Security controls (authN/authZ, tenancy isolation, command provenance) protect who can request actions.
- Safety controls protect physical behavior even when security assumptions fail or latency spikes occur.
- Evidence must record both control-plane intent and edge-side safety outcomes for auditability.

## Standards references

- ISO 12100 (safety of machinery, risk assessment principles)
- ISO 10218 (industrial robot safety requirements)
- ISO/TS 15066 (collaborative robot safety guidance)
- ISO 13849-1 (safety-related parts of control systems)

## Compliance timeline references

- EU machinery framework transition window includes requirements becoming effective in 2027.
- UK machinery safety obligations continue via UKCA/PUWER framework and related HSE guidance.
- US obligations remain OSHA-centered with sector-specific interpretations and state overlays.

## Consequences

- Prevents misplacement of safety-critical logic into non-real-time orchestration layers.
- Clarifies integration contract for robotics adapters and edge gateway implementations.
- Supports governance and audit needs without violating real-time safety architecture principles.

## References

- `bead-0497` robotics domain atlas
- `bead-0505` robotics integration architecture boundary
- `bead-0506` safety boundary bead
