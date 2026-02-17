# Port v1 (Port registry contract)

## Purpose

`Port` is the typed registration model for capability-bound external capability families and how each workspace maps to implementations.

This is the parser surface in `src/domain/ports/port-v1.ts`.

## Schema (`PortV1`)

- `schemaVersion`: `1`
- `portId`: branded `PortId`
- `workspaceId`: branded `WorkspaceId`
- `adapterId`: branded `AdapterId`
- `portFamily`: `PortFamily`
- `name`: non-empty string
- `status`: `Active` | `Inactive` | `Disabled`
- `supportedOperations`: non-empty array of non-empty strings with no duplicates
- `supportedOperations`: must be capability tokens in `<noun>:<action>` format (e.g., `invoice:read`)
- `supportedOperations` values must be valid for the selected `portFamily` and match the capability matrix defined in `docs/domain/port-taxonomy.md`
- `endpoint?`: optional non-empty string
- `auth?`: optional object
  - `mode`: `none` | `apiKey` | `basic` | `oauth2` | `serviceAccount` | `mTLS`
  - `scopes?`: optional array of non-empty strings with no duplicates
- `createdAtIso`: ISO timestamp string
- `updatedAtIso?`: optional ISO timestamp string
