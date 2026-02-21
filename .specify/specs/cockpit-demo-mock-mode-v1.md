# Cockpit Demo Mock Mode v1

## Purpose

Define the backend-free demo behavior for the cockpit presentation layer so stakeholders can run a realistic narrative flow without provisioning control-plane APIs.

## Scope

- Frontend-only mocking for core cockpit entities: Work Item, Run, Approval Gate, Evidence Log.
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

## Out Of Scope

- Live control-plane backend connectivity.
- External credential usage.
- Non-synthetic customer data.
