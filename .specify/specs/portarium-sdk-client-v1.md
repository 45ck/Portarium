# Portarium SDK Client v1

## Purpose

Provides an ergonomic TypeScript client facade for the Portarium Control Plane API. The SDK abstracts HTTP transport, authentication, tracing, idempotency, and error handling behind namespace-scoped method calls.

## Location

- Canonical: `src/sdk/portarium-client.ts`
- Infrastructure re-export: `src/infrastructure/sdk/portarium-client.ts`

## Configuration (`PortariumClientConfig`)

- `baseUrl`: Control plane base URL (e.g., `https://api.portarium.example.com`)
- `auth`: `AuthProvider` -- either `bearerToken` or `mtlsBoundToken`
- `workspaceId`: Target workspace for all operations
- `timeoutMs?`: Request timeout (default: 30000)
- `maxRetries?`: Max retry attempts for transient failures (default: 3)
- `retryBaseDelayMs?`: Base delay for exponential backoff (default: 500)
- `fetchFn?`: Custom fetch implementation for testing
- `traceparent?`: W3C traceparent header value
- `tracestate?`: W3C tracestate header value

## Namespaces

### `client.runs`

- `start(input)`: Start a new workflow run. Auto-generates idempotency key.
- `get(runId)`: Get run details by ID.
- `cancel(runId)`: Cancel a running workflow.

### `client.approvals`

- `submitDecision(input)`: Submit an approval decision (Approved/Denied/RequestChanges).

### `client.agents`

- `register(input)`: Register a new agent with the control plane.
- `heartbeat(input)`: Send a heartbeat from an active agent.

### `client.machines`

- `register(input)`: Register a new machine.
- `heartbeat(input)`: Send a heartbeat from a registered machine.

### `client.events`

- `subscribe(onEvent)`: Subscribe to real-time events (placeholder; will connect to NATS).

## Cross-Cutting Concerns

### Idempotency Key Generation

All mutating operations (POST) include an `Idempotency-Key` header. The key is either provided by the caller or auto-generated via `crypto.randomUUID()`.

### W3C Trace Context

Every request includes `traceparent` and `tracestate` headers when configured. This enables distributed tracing across the SDK, control plane, and Temporal activities.

### Retry with Exponential Backoff

Transient failures (HTTP 429, 502, 503, 504) are retried with exponential backoff: `baseDelay * 2^attempt`. Non-retryable errors (4xx except 429) are thrown immediately.

### RFC 7807 Error Mapping

HTTP error responses are parsed as RFC 7807 Problem Details and wrapped in `PortariumApiError`. The error includes `type`, `title`, `status`, `detail`, and `instance` fields.

### Correlation ID

Every request includes an `X-Correlation-ID` header (UUID) for request tracing in logs.

## Invariants

1. The client never stores or logs authentication tokens.
2. All workspace-scoped paths include the configured `workspaceId`.
3. The `fetchFn` injection point allows full test isolation without network calls.
