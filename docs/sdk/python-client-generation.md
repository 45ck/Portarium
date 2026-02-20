# Python Client Generation Guide

**Beads:** bead-0662

Generate a typed Python client from the Portarium Control Plane OpenAPI specification.

## Prerequisites

- Python >= 3.10
- pip install openapi-python-client

## Quick Start

```bash
# Generate the client
./scripts/codegen/generate-python-client.sh

# Install the generated package in development mode
cd sdks/python/portarium-client
pip install -e ".[dev]"
```

## Usage

```python
from portarium_client import AuthenticatedClient
from portarium_client.api.runs import start_run, get_run
from portarium_client.models import StartRunRequest

# Create an authenticated client with a workspace-scoped JWT
client = AuthenticatedClient(
    base_url="https://portarium.example.com",
    token="eyJhbGciOiJSUzI1NiIs...",
)

# Start a workflow run
request = StartRunRequest(
    workflow_id="wf-invoice-approval",
    input={"invoice_id": "inv-123", "amount": 5000},
)
run = start_run.sync(client=client, workspace_id="ws-acme", body=request)
print(f"Run started: {run.id}, status: {run.status}")

# Async variant
import asyncio

async def main():
    run = await start_run.asyncio(client=client, workspace_id="ws-acme", body=request)
    print(f"Run started: {run.id}")

asyncio.run(main())
```

## Authentication

The client uses workspace-scoped JWTs issued by Portarium. Obtain a token through:

1. **Service account** -- exchange client credentials at `POST /v1/auth/token`
2. **User session** -- redirect through Portarium OIDC flow

Pass the token when constructing `AuthenticatedClient`. Token refresh is caller responsibility.

```python
client = AuthenticatedClient(
    base_url="https://portarium.example.com",
    token=get_fresh_token(),
    headers={"X-Workspace-Id": "ws-acme"},
)
```

## Generated Package Structure

```
sdks/python/portarium-client/
  portarium_client/
    client.py              # AuthenticatedClient / Client
    api/
      workspaces/          # Workspace CRUD
      runs/                # Run lifecycle (start, status, cancel)
      approvals/           # Approval lifecycle
      evidence/            # Evidence queries
      machines/            # Machine/agent registration
      ...
    models/                # Typed dataclasses (attrs) per OpenAPI schema
    errors.py              # Typed error hierarchy
  pyproject.toml
  README.md
```

## CI Integration

The CI pipeline regenerates the client and checks for drift:

```bash
./scripts/codegen/generate-python-client.sh --check
```

This will fail if the committed client differs from what the current OpenAPI spec produces.

## Pagination

List endpoints use cursor-based pagination. The generated client returns cursor metadata:

```python
from portarium_client.api.runs import list_runs

response = list_runs.sync(client=client, workspace_id="ws-acme", limit=20)
for run in response.items:
    print(run.id, run.status)

# Fetch next page
if response.cursor:
    next_page = list_runs.sync(
        client=client, workspace_id="ws-acme", limit=20, cursor=response.cursor
    )
```

## Regenerating After Spec Changes

When the OpenAPI spec at `docs/spec/openapi/portarium-control-plane.v1.yaml` changes:

1. Run `./scripts/codegen/generate-python-client.sh`
2. Run `cd sdks/python/portarium-client && mypy --strict portarium_client/`
3. Commit the regenerated output
