# API Backward Compatibility and Versioning v1

This spec defines compatibility rules for the control-plane HTTP API and its
OpenAPI contract.

Primary contract source:

- `docs/spec/openapi/portarium-control-plane.v1.yaml`

## Versioned paths

- Public HTTP paths must be explicitly versioned under `/v1`.
- New major versions use new path roots (for example `/v2/...`) and must be
  introduced intentionally, not by silent mutation of `/v1`.

## Additive-only evolution inside `/v1`

- Breaking changes are not allowed on existing `/v1` operations.
- Existing schema properties must not be removed.
- Existing optional properties must not become required.
- New fields are additive and should be optional by default.

## Deprecation policy

- Any deprecated operation must set `deprecated: true` in OpenAPI.
- Deprecated operations must include deprecation guidance in operation
  description text.
- Deprecation notice should include migration target and expected removal window.

## Content negotiation policy

- Request bodies must support JSON (`application/json`).
- Responses with content must expose JSON-compatible media types (`application/json`
  or `application/problem+json`).
- Error surfaces should use `application/problem+json` and RFC 9457 semantics.

## Enforcement

- CI compatibility check: `npm run openapi:compat:check`
- CI operation ID stability check: `npm run openapi:breaking:check`
- CI operation ID golden parity: `npm run openapi:operation-ids:check`
