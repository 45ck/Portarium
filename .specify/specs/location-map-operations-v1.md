# Location-Integrated Map Operations v1

## Purpose

Define first-contract scope for map-centric operations across location telemetry, map layer metadata, and map API surfaces.

This spec anchors:

- `LocationEvent` (normalized telemetry contract)
- `MapLayer` (rendering and policy context contract)
- API contract expectations for live subscriptions and history queries

## Contract: LocationEvent

`LocationEvent` is an append-only telemetry event for an asset/robot position sample.

Required fields:

- `schemaVersion`: `1`
- `locationEventId`: branded identifier
- `tenantId`: branded tenant/workspace identifier
- `assetId`: branded canonical asset identifier
- `robotId?`: optional branded robot identifier
- `sourceStreamId`: branded stream identifier used for monotonic checks
- `sourceType`: `GPS | RTLS | SLAM | odometry | fusion`
- `coordinateFrame`: non-empty frame name (for example: `map`, `site`, `floor-1`)
- `observedAtIso`: observation timestamp (RFC3339/ISO-8601)
- `ingestedAtIso`: ingestion timestamp (RFC3339/ISO-8601)
- `pose`: `{ x, y, z, yawRadians }`
- `velocity?`: `{ linearMetersPerSec, angularRadiansPerSec }`
- `quality`: one of:
  - `{ status: "Known", horizontalStdDevMeters, verticalStdDevMeters? }`
  - `{ status: "Unknown", reason }`
- `correlationId`: trace/evidence correlation identifier

Invariants:

- Per `sourceStreamId`, event order is monotonic by `observedAtIso`.
- `ingestedAtIso` must not be before `observedAtIso`.
- Unknown quality is explicit (`status: "Unknown"`), never implicit/null.

## Contract: MapLayer

`MapLayer` captures versioned mapping context for rendering and policy checks.

Required fields:

- `schemaVersion`: `1`
- `mapLayerId`: branded identifier
- `tenantId`: branded tenant/workspace identifier
- `siteId`: branded site identifier
- `floorId`: branded floor identifier
- `layerType`: `Floorplan | OccupancyGrid | Geofence | SemanticZone`
- `coordinateFrame`: non-empty frame name
- `origin`: `{ x, y, z }`
- `version`: integer `>= 1`
- `validFromIso`: RFC3339/ISO-8601 timestamp
- `validToIso?`: optional RFC3339/ISO-8601 timestamp
- `provenance`: `{ sourceType, sourceRef, registeredAtIso, registeredBy }`
- `boundToMapVersion?`: integer map version reference for policy/zone overlays

Invariants:

- `validToIso` must be after or equal to `validFromIso` when present.
- `Geofence` and `SemanticZone` must provide `boundToMapVersion`.
- `boundToMapVersion` must be `>= 1` when present.

## API contract expectations (for OpenAPI v1 extension)

### Live subscription endpoint

- `GET /v1/workspaces/{workspaceId}/location-events:stream`
- Transport: SSE or WebSocket upgrade (implementation decision in API layer bead)
- Behavior:
  - emits latest samples and updates filtered by site/floor/asset
  - includes correlation headers/metadata
  - documents stale stream semantics

### History query endpoint

- `GET /v1/workspaces/{workspaceId}/location-events`
- Required query:
  - `fromIso`, `toIso`
- Optional query:
  - `assetId`, `siteId`, `floorId`, `sourceType`, pagination cursor
- Behavior:
  - returns time-window trails for playback
  - enforces retention windows and RBAC

### Map-layer endpoint

- `GET /v1/workspaces/{workspaceId}/map-layers`
- Optional query:
  - `siteId`, `floorId`, `layerType`, `version`
- Behavior:
  - returns active/versioned layer metadata
  - supports floor and zone overlays for cockpit map surfaces

## UX acceptance criteria

- Overview-first:
  - default response payloads prioritize current location state and key status signals
- Details-on-demand:
  - clients can query full per-asset history and layer metadata only when needed
- Time-window playback:
  - API supports deterministic windowed playback for selected asset/floor/site scopes

## Governance hooks

- All endpoints are tenant-isolated and require workspace-scoped authorization.
- History retention windows are enforced before query execution.
- Access purpose metadata must be captured for auditability.

## Infrastructure query budgets

- Latest pose (`getLatestPose`) target latency budget: `p95 <= 50ms`.
- History window query (`queryHistory`) target latency budget: `p95 <= 250ms` for typical cockpit windows.
- These budgets are exposed as infrastructure defaults to keep API boundary behavior explicit.

## Glossary alignment notes

New terms introduced for this slice:

- `LocationEvent`
- `MapLayer`
- `Coordinate Frame`
- `Source Stream`

These terms are now used consistently across domain and API contracts for map operations.

## Contract test targets

- Live subscription boundary:
  - authz and tenant isolation checks for `/location-events:stream`
- History query boundary:
  - invalid/oversized window rejection, retention expiry rejection, pagination limits
- Map-layer query boundary:
  - workspace isolation and layer-type filtering behavior

Planned implementation target files:

- `src/infrastructure/openapi/openapi-contract.test.ts`
- `src/presentation/runtime/control-plane-handler.test.ts` (route-level boundary behavior)
