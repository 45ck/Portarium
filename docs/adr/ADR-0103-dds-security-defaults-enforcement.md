# ADR-0103 — DDS-Security Defaults Enforcement (No Harden-Later)

**Status:** Accepted
**Date:** 2026-02-23
**Bead:** bead-fv8i

---

## Context

Portarium connects to robotics systems through three gateway adapters:

1. **gRPC Mission Gateway** — direct gRPC to edge gateways
2. **MQTT Mission Gateway** — MQTT broker HTTP API for fleet messaging
3. **ROS 2 Action Bridge** — rosbridge WebSocket protocol for ROS 2 nodes

All three adapters accept transport configuration that allows insecure connections.
The gRPC adapter defaults to `grpc.credentials.createInsecure()` when no credentials
are provided. The MQTT adapter accepts any broker URL (including plaintext HTTP).
The ROS 2 bridge connects via unencrypted WebSocket (`ws://`) by default.

The "harden-later" anti-pattern — shipping insecure defaults with the intent to
configure security in production — is a documented root cause of robotics security
incidents. DDS-Security (SROS 2 in the ROS 2 ecosystem) provides authentication,
encryption, and topic-level access control at the DDS middleware layer, but is
frequently left disabled in development and forgotten in deployment.

---

## Decision

**Enforce secure transport defaults for all robotics gateway configurations.**

Specifically:

1. **Domain-level validation** (`src/domain/robots/dds-security-defaults-v1.ts`)
   enforces the following rules:
   - Production gateways MUST use a secure transport mode (`mTLS`, `TLS`, or `SROS2`).
   - `Insecure` transport is only permitted when `developmentMode` is explicitly `true`.
   - ROS 2 bridge gateways in production MUST use `SROS2` (not just TLS), because
     TLS only secures the control-plane link, not the DDS data bus.

2. **SROS 2 keystore configuration** is validated for correctness:
   - Keystore path, domain ID, and enclave name are required.
   - Certificate TTL and renewal lead times must be consistent.

3. **No implicit fallback to insecure.** Adapters that cannot resolve credentials
   MUST fail at startup, not silently downgrade to plaintext.

---

## Consequences

### Positive

- Robotics communication is secure by default — there is no production path that
  bypasses encryption or authentication.
- The development mode opt-in (`developmentMode: true`) is explicit and auditable,
  making it easy to grep for and flag in code review or CI.
- ROS 2 deployments get DDS-native security (SROS 2) rather than relying solely
  on transport-layer TLS, which does not protect the DDS data bus from unauthorized
  participants on the same network segment.

### Negative / Accepted Risks

- **Developer friction:** Local development requires setting `developmentMode: true`
  explicitly. This is intentional — developers should be aware they are running
  without security.
- **SROS 2 setup complexity:** Provisioning an SROS 2 keystore requires PKI
  infrastructure (see `docs/integration/ros2-bridge-architecture.md`). This is
  mitigated by the bootstrap token flow and auto-renewal documented there.

---

## Alternatives Considered

### Allow TLS for ROS 2 in production

TLS secures the link between Portarium and the bridge node, but does not protect
the DDS domain from unauthorized ROS 2 participants. An attacker on the robot
network could inject commands or subscribe to telemetry without SROS 2 governance.

Rejected because it leaves the most critical attack surface (the robot network)
unprotected.

### Runtime warning instead of hard failure

A warning log when insecure transport is detected in production, without blocking
startup. This matches the "harden-later" pattern we explicitly reject — warnings
are ignored, insecure deployments persist.

Rejected in favour of fail-fast validation.

---

## Compliance Mapping

| Control                  | Standard             | Satisfied?                               |
| ------------------------ | -------------------- | ---------------------------------------- |
| Encrypted communications | IEC 62443-3-3 SR 4.1 | Yes — mTLS/TLS/SROS2 required            |
| Device authentication    | IEC 62443-3-3 SR 1.1 | Yes — mTLS and SROS2 provide mutual auth |
| Network segmentation     | IEC 62443-3-3 SR 5.1 | Partial — SROS2 governance restricts DDS |
| Secure by default        | NIST CSF PR.IP-1     | Yes — insecure requires explicit opt-in  |

---

## Links

- `src/domain/robots/dds-security-defaults-v1.ts` — domain validation
- `docs/integration/ros2-bridge-architecture.md` — SROS 2 PKI provisioning
- `src/infrastructure/adapters/robotics-gateway/spiffe-grpc-credentials.ts` — SPIFFE mTLS
- ADR-0076 — SPIRE workload identity and mTLS
