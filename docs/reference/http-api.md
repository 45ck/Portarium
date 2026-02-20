# Reference: HTTP API

Human-readable API reference for the current control-plane scaffold.

## Source of truth

- `docs/spec/openapi/portarium-control-plane.v1.yaml`

## Conventions

- Base path: `/v1`
- Workspace scope: `/v1/workspaces/{workspaceId}/...`
- Auth: bearer token (JWT/JWKS)
- Errors: `application/problem+json` (RFC 7807 shape)
- Correlation and trace headers: `x-correlation-id`, `traceparent`, `tracestate`

## Selected endpoints in current runtime

| Method | Path                                                              | Notes               |
| ------ | ----------------------------------------------------------------- | ------------------- |
| GET    | `/v1/workspaces/{workspaceId}`                                    | workspace read      |
| GET    | `/v1/workspaces/{workspaceId}/runs/{runId}`                       | run read            |
| GET    | `/v1/workspaces/{workspaceId}/workforce`                          | workforce list      |
| GET    | `/v1/workspaces/{workspaceId}/human-tasks`                        | human task list     |
| POST   | `/v1/workspaces/{workspaceId}/human-tasks/{humanTaskId}/complete` | complete human task |
| GET    | `/v1/workspaces/{workspaceId}/evidence`                           | evidence list       |
| GET    | `/v1/workspaces/{workspaceId}/location-events`                    | telemetry history   |
| GET    | `/v1/workspaces/{workspaceId}/map-layers`                         | map layers          |

## Error example

```json
{
  "type": "https://portarium.dev/problems/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Authentication not configured.",
  "instance": "/v1/workspaces/demo"
}
```

## Implementation note

The handler currently includes fixture-backed and stubbed paths while persistence adapters are being completed.
