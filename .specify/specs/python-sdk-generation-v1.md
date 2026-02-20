# Python SDK Generation Contract v1

**Beads:** bead-0662

## Purpose

Define the contract for generating a typed Python client from the Portarium Control Plane
OpenAPI specification, ensuring SDK consumers get a first-class developer experience with
type safety, async support, and workspace-scoped auth.

## Scope

- Code-generation pipeline from `docs/spec/openapi/portarium-control-plane.v1.yaml`
- Generated client package structure and naming conventions
- Authentication integration (bearer token / workspace-scoped JWT)
- Generated model types matching OpenAPI schemas
- Async and sync client variants

## Generator

- Tool: `openapi-python-client` (MIT, actively maintained)
- Input: `docs/spec/openapi/portarium-control-plane.v1.yaml`
- Output: `sdks/python/portarium-client/`

## Generated Package Requirements

### Package metadata
- Name: `portarium-client`
- Python version: >= 3.10
- Dependencies: `httpx`, `attrs`, `python-dateutil`
- Dev dependencies: `pytest`, `mypy`, `ruff`

### Client structure
- `portarium_client/client.py` -- `AuthenticatedClient` with bearer token
- `portarium_client/api/` -- one module per OpenAPI tag (workspaces, runs, approvals, etc.)
- `portarium_client/models/` -- attrs-based dataclasses per schema
- `portarium_client/errors.py` -- typed error hierarchy from Problem responses

### Auth contract
- Client accepts `base_url` and `token` (workspace-scoped JWT)
- All requests include `Authorization: Bearer {token}` header
- Client must set `X-Workspace-Id` header when workspace context is known
- Token refresh is caller responsibility (client does not manage token lifecycle)

### Endpoint coverage
- All paths under `/v1/workspaces/` in the OpenAPI spec
- Cursor-based pagination helpers for list endpoints
- Proper enum types for `ApprovalDecision`, `ExecutionTier`, `WorkspaceUserRole`

## CI Integration

- `scripts/codegen/generate-python-client.sh` regenerates the client
- CI diff check: regenerate and fail if output differs from committed SDK
- Version bump follows OpenAPI spec `info.version` changes

## Acceptance Criteria

1. `generate-python-client.sh` runs without errors against the current OpenAPI spec
2. Generated client includes typed models for all OpenAPI schemas
3. Generated client includes async variants for all API methods
4. Generated package passes `mypy --strict` type checking
5. README documents installation, auth setup, and basic usage
