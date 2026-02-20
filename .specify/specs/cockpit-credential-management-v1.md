# Cockpit Credential Management v1

## Context

Cockpit needs a credential management surface so operators can review and control credential grants bound to adapters.

## Scope

- Add cockpit route `GET /config/credentials`.
- Render credential grants table with:
  - `credentialGrantId`
  - adapter display name
  - credential name and type (derived from `credentialsRef`)
  - granted timestamp
  - granted-by label
  - expiry timestamp
  - lifecycle status (`active`, `revoked`, `expired`)
- Provide `Grant Credential` action wired to `POST /v1/workspaces/{workspaceId}/credential-grants`.
- Provide per-row `Revoke` action wired to `POST /v1/workspaces/{workspaceId}/credential-grants/{credentialGrantId}/revoke`.
- Require a confirmation dialog before revoke dispatch.
- Add `Credentials` navigation entry under cockpit `Config`.

## Acceptance

- `/config/credentials` is reachable from sidebar nav.
- Credential grants list is loaded from the workspace API endpoint.
- Triggering `Grant Credential` dispatches create request and refreshes list.
- Triggering `Revoke` requires explicit confirmation and refreshes list after success.
- Route smoke tests cover `/config/credentials`.
