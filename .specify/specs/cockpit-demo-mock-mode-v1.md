# Cockpit Demo Mock Mode v1

## Purpose

Define the backend-free demo behavior for the cockpit presentation layer so stakeholders can run a realistic narrative flow without provisioning control-plane APIs.

## Scope

- Frontend-only mocking for core cockpit entities: Work Item, Run, Approval Gate, Evidence Log, and prototype robotics surfaces.
- Deterministic fixture bootstrap and in-browser `/api/*` interception.
- Operator narrative: queue -> inspect -> decide -> status transition -> evidence append.

## Requirements

1. Demo data must load from versioned JSON fixtures.
2. The presentation layer must use API-shaped requests (`/api/*`) instead of direct inline constants.
3. Approval decision submission must mutate linked Run and Work Item status in mock state.
4. Every decision mutation must append an Evidence entry with previous-hash linkage.
5. The UI must expose an explicit reset control to restore deterministic demo state.
6. Demo state and labels must clearly indicate mocked/synthetic data.
7. Scripted demo-machine clips must cover approval, evidence, correlation, capability posture, degraded realtime, and agent integration narratives with reset preconditions.
8. Demo persistence may contain synthetic fixture data only and must remain resettable; it must not define live tenant-data retention behavior.
9. Fixture-backed demo controls must be available only when Cockpit is running with the mock service worker enabled. `VITE_DEMO_MODE=true` must not unlock demo fixtures when `VITE_PORTARIUM_ENABLE_MSW=false`.
10. Robotics routes that consume `/v1/workspaces/{workspaceId}/robotics/*` are fixture-backed demo surfaces. Live or dev-live Cockpit must hide them from shell navigation and command search, and direct route visits must render an unsupported state without invoking those mock-only endpoints.
11. Robotics demo copy must distinguish simulated telemetry and simulated command paths from live hardware events.

## Out Of Scope

- Live control-plane backend connectivity.
- External credential usage.
- Non-synthetic customer data.
