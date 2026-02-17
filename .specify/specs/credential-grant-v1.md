# Credential Grant v1 (Workspace Credential Binding)

## Purpose

Credential grants represent workspace-scoped references to credentials stored in a secret vault. They are used by adapter bindings and machine registration flows to authenticate outbound execution.

This corresponds to the `CredentialGrant` entity in `docs/domain/aggregates.md`.

## Schema (CredentialGrantV1)

Fields:

- `schemaVersion`: `1`
- `credentialGrantId`: branded `CredentialGrantId`
- `workspaceId`: branded `WorkspaceId`
- `adapterId`: branded `AdapterId`
- `credentialsRef`: vault reference identifier
- `scope`: permission scope string
- `issuedAtIso`: RFC3339 timestamp
- `expiresAtIso?`: optional RFC3339 timestamp
- `lastRotatedAtIso?`: optional RFC3339 timestamp
- `revokedAtIso?`: optional RFC3339 timestamp

## Requests

- `CreateCredentialGrantRequestV1`: `schemaVersion`, `adapterId`, `credentialsRef`, `scope`, optional `expiresAtIso`
- `UpdateCredentialGrantRequestV1`: partial update payload
- `RotateCredentialGrantRequestV1`: new `credentialsRef`, optional `scope`, `rotatedAtIso`, optional `expiresAtIso`
- `RevokeCredentialGrantRequestV1`: `revokedAtIso`

## Notes

- Lifecycle helpers enforce ordering (issued -> rotated/revoked) and reject timestamp regression.

## Endpoints

- `GET /v1/workspaces/{workspaceId}/credential-grants`
- `POST /v1/workspaces/{workspaceId}/credential-grants`
- `GET /v1/workspaces/{workspaceId}/credential-grants/{credentialGrantId}`
- `PATCH /v1/workspaces/{workspaceId}/credential-grants/{credentialGrantId}`
- `DELETE /v1/workspaces/{workspaceId}/credential-grants/{credentialGrantId}`
- `POST /v1/workspaces/{workspaceId}/credential-grants/{credentialGrantId}/rotate`
- `POST /v1/workspaces/{workspaceId}/credential-grants/{credentialGrantId}/revoke`

## Schemas

- `CredentialGrantV1`
- `CredentialGrantListResponse`
- `CreateCredentialGrantRequest`
- `UpdateCredentialGrantRequest`
- `RotateCredentialGrantRequest`
- `RevokeCredentialGrantRequest`
