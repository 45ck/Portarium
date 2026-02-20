# ADR-0043: Control Plane API Contract (OpenAPI)

## Status

Accepted

## Context

Portarium is API-first: the dashboard is a client. We need a stable, versioned contract for external clients (UI, automation, operators) and for internal implementation to converge on.

We already have versioned domain schemas (e.g. Plan v1, Evidence v1) and an explicit split of public surfaces (Commands, Queries, Event stream) in the ubiquitous language.

## Decision

- Publish the control plane HTTP contract as an **OpenAPI 3.1** document under `docs/spec/openapi/`.
- Use **URL versioning** for the public surface: `/v1/...`.
- Preserve **resource schema versioning** inside versioned payloads (e.g. `schemaVersion: 1` for Plan/Evidence) to support safe evolution.
- Standardize errors as **RFC 7807** `application/problem+json`.
- Make tenancy explicit: all tenant-scoped objects are addressed under `/v1/workspaces/{workspaceId}/...`.
- Apply CQRS semantics:
  - **Commands** mutate state and must support idempotency (`Idempotency-Key` header where applicable).
  - **Queries** are side-effect free and use cursor pagination (`limit` + `cursor`).
- Event stream remains CloudEvents (ADR-0032) and will be specified as a separate contract slice when the transport is locked (SSE vs webhooks vs broker).

## Consequences

- We can generate clients, docs, and contract tests from a single source of truth.
- Contract changes become explicit design changes (ADR + spec update), reducing accidental API drift.
- We must maintain backward compatibility within `/v1` or cut `/v2` when breaking changes are required.

## Implementation Notes

- OpenAPI contract publication and validation were implemented via:
  - `bead-0031` (control plane API OpenAPI v1)
  - `bead-0014` (OpenAPI contract gate + boundary tests)
  - `bead-0447` (contract alignment updates)
