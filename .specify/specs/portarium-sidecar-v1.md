# Portarium Sidecar v1

## Purpose

Define the sidecar daemon that runs alongside each workload container to
provide security, observability, and networking infrastructure without
requiring the workload to implement these concerns.

## Responsibilities

### 1. mTLS Termination

- Uses SPIFFE/SPIRE SVIDs for workload identity.
- Terminates inbound mTLS connections from other cluster services.
- Rotates SVIDs automatically before expiry.

### 2. Token Acquisition and Refresh

- Acquires workspace-scoped JWTs for control-plane communication.
- Refreshes tokens before expiry (configurable buffer).
- Credentials stored in file paths (Kubernetes secrets / CSI volumes), never
  embedded in config.

### 3. Egress Allowlist Enforcement

- All outbound traffic must pass through the sidecar proxy.
- Egress rules define allowed host patterns, ports, and methods.
- Blocked destinations receive a 403 with a reason in the response body.
- Default-deny: if no rule matches, the request is blocked.

### 4. Trace-Context Injection

- Injects W3C `traceparent` and `tracestate` headers into all proxied
  outbound requests.
- Preserves existing headers when present.

## Configuration

The sidecar is configured via a `SidecarConfig` object:

- `workspaceId` -- scoping for credential acquisition and policy.
- `mtls` -- SVID cert/key paths, trust bundle, rotation interval.
- `token` -- token endpoint, client credentials, audience, refresh buffer.
- `egress` -- allowlist rules.
- `proxyPort` -- local listen port (default 15001).
- `adminPort` -- health/status endpoint (default 15000).

## Deployment

- Runs as a sidecar container in the same pod.
- Distroless base image for minimal attack surface.
- iptables rules (init container) redirect egress traffic through the proxy.

## Health and Admin

- `GET /healthz` on admin port -- returns sidecar state.
- `GET /status` -- returns token expiry, SVID expiry, egress rule count.

## Test Expectations

- Egress proxy: allow/deny by host, port, method, wildcard.
- Blocked destinations correctly identified.
- `buildInitialStatus` returns correct initial state.
