# ADR-0058: Presentation API Client Strategy

**Bead:** bead-0342
**Status:** Accepted
**Date:** 2026-02-18

## Context

The ops-cockpit frontend needs to call the Portarium control-plane API (OpenAPI v1). Options:

- Hand-written fetch wrappers (no type safety at boundary)
- Generated typed client from OpenAPI spec (type-safe, stays in sync)
- GraphQL BFF (deferred, see bead-0382)

The project already has an OpenAPI spec in `src/presentation/ops-cockpit/openapi.yaml` and a hand-written `http-client.ts`. Coverage is 61% (bead-0333).

## Decision

Generate a typed API client from the OpenAPI spec using `openapi-typescript` (schema types) + `openapi-fetch` (zero-overhead fetch wrapper). Runtime response validation uses `zod` schemas derived from the OpenAPI types at the presentation boundary.

**Schema types**: `npm run generate:api-types` → `src/presentation/ops-cockpit/generated/api.ts`
**Client instance**: `src/presentation/ops-cockpit/api-client.ts` wraps `createClient` from `openapi-fetch`
**Runtime validation**: Each response parsed through a Zod schema before use; failure → RFC 9457 Problem Details `UnexpectedResponseShape`

## Consequences

- API drift is caught at CI (schema regeneration fails on mismatch)
- Frontend never accesses raw `any`-typed responses
- Adding a new endpoint requires only an OpenAPI spec change; the client updates automatically
- Zod schemas add a small runtime cost; scoped to network boundary only

## Implementation Mapping

- Closed implementation coverage:
  - `bead-0342`
  - `bead-0382`
- ADR linkage verification review bead:
  - `bead-0614`

## Review Linkage

- `docs/internal/review/bead-0614-adr-0058-linkage-review.md`
