# Go SDK Generation Contract v1

**Beads:** bead-0663

## Purpose

Define the contract for generating a typed Go client from the Portarium Control Plane
OpenAPI specification using `oapi-codegen`, ensuring idiomatic Go types, context-aware
HTTP methods, and workspace-scoped authentication.

## Scope

- Code-generation pipeline from `docs/spec/openapi/portarium-control-plane.v1.yaml`
- Generated package structure and naming conventions
- Authentication integration (bearer token / workspace-scoped JWT)
- Context propagation for cancellation and tracing
- Error handling aligned with Go conventions

## Generator

- Tool: `oapi-codegen` (Apache-2.0, official OpenAPI Go codegen)
- Input: `docs/spec/openapi/portarium-control-plane.v1.yaml`
- Output: `sdks/go/portarium/`

## Generated Package Requirements

### Package metadata
- Module: `github.com/portarium/portarium-go`
- Go version: >= 1.21
- Dependencies: `net/http` (stdlib), optional `github.com/oapi-codegen/runtime`

### Generated structure
- `portarium/client.go` -- `ClientWithResponses` with bearer auth
- `portarium/types.go` -- Go structs per OpenAPI schema (branded IDs as `string` typedefs)
- `portarium/client_gen.go` -- generated request/response methods
- `portarium/models_gen.go` -- generated model types

### Auth contract
- Client constructor accepts `WithRequestEditorFn` for injecting bearer token
- All requests include `Authorization: Bearer {token}` header via editor function
- `WithWorkspace(id string)` convenience editor sets `X-Workspace-Id` header

### Endpoint coverage
- All paths under `/v1/workspaces/` in the OpenAPI spec
- Methods accept `context.Context` as first parameter
- Cursor pagination via `Limit` and `Cursor` query params
- Proper Go enums (const blocks) for `ApprovalDecision`, `ExecutionTier`, `WorkspaceUserRole`

### Error handling
- Non-2xx responses return typed `*ErrorResponse` (maps to RFC 7807 Problem)
- Network errors propagated via standard `error` return
- `ClientWithResponses` provides parsed response bodies

## CI Integration

- `scripts/codegen/generate-go-client.sh` regenerates the client
- CI diff check: regenerate and fail if output differs from committed SDK
- Version tag follows OpenAPI spec `info.version` changes

## Acceptance Criteria

1. `generate-go-client.sh` runs without errors against the current OpenAPI spec
2. Generated client compiles with `go build ./...`
3. Generated types include all OpenAPI schemas
4. All methods accept `context.Context` for cancellation/tracing
5. README documents installation, auth setup, and basic usage
