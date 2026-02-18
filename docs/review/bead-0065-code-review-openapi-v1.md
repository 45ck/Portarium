# Code Review: bead-0065 (Control Plane API v1 OpenAPI)

Reviewed on: 2026-02-18

Scope:

- OpenAPI contract: `docs/spec/openapi/portarium-control-plane.v1.yaml`
- Contract validation tests: `src/infrastructure/openapi/openapi-contract.test.ts`
- Error shape expectations (Problem Details) and auth surface

## Findings

### High

- None found.

### Medium

- The OpenAPI spec does not currently encode role gating / authorization requirements per route.
  - Impact: Clients and reviewers cannot mechanically verify RBAC coverage; role drift becomes likely as endpoints expand.
  - Recommendation: Add an explicit per-operation authorization annotation (e.g. `x-portarium-required-roles` and/or `x-portarium-action`) and a test asserting every route defines it (deny-by-default).

- Some operations rely on a `default` Problem response, but do not enumerate common authn/authz status codes (`401`, `403`) explicitly.
  - Impact: Client generators and API documentation will not surface the expected error semantics clearly.
  - Recommendation: Add explicit `401`/`403` responses that reference the shared Problem schema.

### Low

- `servers.url` is `http://localhost:3000` while the local compose scaffold exposes `8080` by default.
  - Impact: Minor developer confusion when using the spec directly.
  - Recommendation: Align server examples with the local runtime default, or add multiple server entries.

## Notes

- The spec consistently scopes resources under `/v1/workspaces/{workspaceId}/...`, which is aligned with tenant boundary expectations.
- Schema versioning (`schemaVersion: const 1`) is present across domain-shaped payloads and provides a clear migration hook.
- Contract tests exist and validate representative payloads against key schemas, reducing the risk of silent spec drift.
