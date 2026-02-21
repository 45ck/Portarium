# Spec: Cockpit Mobile Foundation OpenAPI Client Alignment (v1)

## Context

Cockpit mobile delivery needs a single API surface aligned to the OpenAPI contract so route/hooks behavior does not drift across desktop and mobile surfaces.

## Requirements

1. Cockpit must provide one shared control-plane client for core entities:
   - Approvals
   - Runs
   - Work Items
   - Workflows
2. Core entity hooks/routes must use the shared client instead of direct `fetch` calls.
3. The shared client must support:
   - env-configured API base URL
   - bearer token injection
   - `application/problem+json` normalization into a typed error
4. Approvals decision endpoint must align to OpenAPI path naming (`/decide`).
5. Work Item status typing must match OpenAPI enum values.
6. CI must fail when cockpit core-entity API usage drifts from generated OpenAPI client artifacts or bypasses the shared client.

## Acceptance

- Cockpit core entity hooks compile against one shared client surface.
- No direct cockpit `fetch` usage remains for core entity endpoints.
- `npm run ci:pr` passes with cockpit API drift checks enabled.
