# Adapter Registration v1

## Purpose

Adapter registrations are declarations for a connector (`AdapterId`) that binds a provider
(`providerSlug`) to a specific `PortFamily` within a workspace.

They must include a complete capability matrix for the port family they claim to support.

## Schema (AdapterRegistrationV1)

Fields:

- `schemaVersion`: `1`
- `adapterId`: branded `AdapterId`
- `workspaceId`: branded `WorkspaceId`
- `providerSlug`: provider identifier (e.g., `hubspot`)
- `portFamily`: one of the canonical `PortFamily` values
- `enabled`: whether the adapter is currently active
- `capabilityMatrix`: required array covering all required operations for the port family
- `machineRegistrations?`: optional list of machine bindings
  - `machineId`: branded `MachineId`
  - `endpointUrl`: absolute URL with `http` or `https`
  - `active`: whether the machine is active
  - `displayName?`: optional human label
  - `authHint?`: optional hint for operator setup

### Request examples

- `POST /v1/workspaces/{workspaceId}/adapter-registrations`

```json
{
  "schemaVersion": 1,
  "providerSlug": "hubspot",
  "portFamily": "CrmSales",
  "enabled": true,
  "capabilityMatrix": [
    {
      "operation": "party:read",
      "requiresAuth": true,
      "inputKind": "Party",
      "outputKind": "Party"
    },
    {
      "operation": "party:write",
      "requiresAuth": true,
      "inputKind": "Party",
      "outputKind": "Party"
    },
    {
      "operation": "opportunity:read",
      "requiresAuth": true,
      "inputKind": "Opportunity",
      "outputKind": "Opportunity"
    },
    {
      "operation": "opportunity:write",
      "requiresAuth": true,
      "inputKind": "Opportunity",
      "outputKind": "Opportunity"
    }
  ],
  "machineRegistrations": [
    {
      "machineId": "machine-1",
      "endpointUrl": "https://machine.example.local",
      "active": true,
      "displayName": "Poster machine",
      "authHint": "oauth-client-secret"
    }
  ]
}
```

- `PATCH /v1/workspaces/{workspaceId}/adapter-registrations/{adapterId}`

```json
{
  "enabled": false,
  "providerSlug": "hubspot",
  "machineRegistrations": [
    {
      "machineId": "machine-1",
      "endpointUrl": "https://machine.example.internal",
      "active": false
    }
  ]
}
```

## Capability rules

- `capabilityMatrix` entries must be complete and unique for the selected family.
- Every `capabilityMatrix.operation` must be one of that family’s required operations.
- `operation` must be in `<entity>:<verb>` format.
- `inputKind` / `outputKind` must be valid `PortContract` output kinds when supplied.

## Validation notes

- The parser throws `AdapterRegistrationParseError` for schema/shape errors, unsupported
  families, missing operations, and malformed machine endpoint URLs.
