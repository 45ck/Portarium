# Go Client Generation Guide

**Beads:** bead-0663

Generate a typed Go client from the Portarium Control Plane OpenAPI specification.

## Prerequisites

- Go >= 1.21
- `go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest`

## Quick Start

```bash
# Generate the client
./scripts/codegen/generate-go-client.sh

# Use in your Go module
cd sdks/go/portarium
go build ./...
```

## Usage

```go
package main

import (
    "context"
    "fmt"
    "net/http"

    portarium "github.com/portarium/portarium-go"
)

func main() {
    // Create client with bearer token auth
    token := "eyJhbGciOiJSUzI1NiIs..."
    client, err := portarium.NewClientWithResponses(
        "https://portarium.example.com",
        portarium.WithRequestEditorFn(func(ctx context.Context, req *http.Request) error {
            req.Header.Set("Authorization", "Bearer "+token)
            req.Header.Set("X-Workspace-Id", "ws-acme")
            return nil
        }),
    )
    if err != nil {
        panic(err)
    }

    ctx := context.Background()

    // Start a workflow run
    workspaceId := "ws-acme"
    resp, err := client.StartRunWithResponse(ctx, workspaceId, portarium.StartRunRequest{
        WorkflowId: "wf-invoice-approval",
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Run started: %s, status: %d\n", resp.JSON201.Id, resp.StatusCode())

    // List runs with pagination
    limit := 20
    listResp, err := client.ListRunsWithResponse(ctx, workspaceId, &portarium.ListRunsParams{
        Limit: &limit,
    })
    if err != nil {
        panic(err)
    }
    for _, run := range listResp.JSON200.Items {
        fmt.Printf("Run %s: %s\n", run.Id, run.Status)
    }
}
```

## Authentication

The client uses workspace-scoped JWTs issued by Portarium. Pass a `WithRequestEditorFn`
to inject the bearer token into every request.

```go
client, _ := portarium.NewClientWithResponses(
    baseURL,
    portarium.WithRequestEditorFn(bearerAuth(token)),
)

func bearerAuth(token string) portarium.RequestEditorFn {
    return func(ctx context.Context, req *http.Request) error {
        req.Header.Set("Authorization", "Bearer "+token)
        return nil
    }
}
```

## Generated Package Structure

```
sdks/go/portarium/
  models_gen.go    # Go structs per OpenAPI schema
  client_gen.go    # HTTP client with typed request/response methods
  go.mod
  go.sum
```

## CI Integration

```bash
./scripts/codegen/generate-go-client.sh --check
```

Fails if the committed client differs from what the current OpenAPI spec produces.

## Error Handling

Non-2xx responses are available through typed response fields:

```go
resp, err := client.StartRunWithResponse(ctx, wsId, body)
if err != nil {
    // Network / transport error
    return err
}
if resp.JSON201 != nil {
    // Success
    return nil
}
if resp.JSONDefault != nil {
    // RFC 7807 Problem response
    return fmt.Errorf("API error %d: %s", resp.JSONDefault.Status, resp.JSONDefault.Detail)
}
```
