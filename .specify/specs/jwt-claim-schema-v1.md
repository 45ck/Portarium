# JWT Claim Schema v1

**Status:** Accepted
**Bead:** bead-0669
**Date:** 2026-02-21

## Context

Portarium requires a standardised JWT claim set so that all services enforce
consistent workspace scoping and identity resolution. Without a shared schema,
each service may parse tokens differently, leading to inconsistent authorization
and potential privilege escalation through missing workspace checks.

## Decision

Define a canonical `PortariumJwtClaimsV1` type and a strict parser
(`parsePortariumJwtClaims`) in `src/infrastructure/auth/jwt-claim-schema-v1.ts`.

### Required claims

| Claim         | Type                   | Description                                      |
|---------------|------------------------|--------------------------------------------------|
| `sub`         | `string`               | Subject — the principal identity                  |
| `iss`         | `string`               | Issuer — identity provider that minted the token  |
| `aud`         | `string \| string[]`   | Audience — intended recipients                    |
| `workspaceId` | `string`               | Workspace scope (mandatory). Falls back to `tenantId` |
| `tenantId`    | `string`               | Alias for workspaceId in v1                       |
| `roles`       | `WorkspaceUserRole[]`  | Non-empty array of workspace roles                |

### Optional claims

| Claim          | Type       | Description                                       |
|----------------|------------|---------------------------------------------------|
| `agentId`      | `string`   | AI agent identity (when token represents an agent) |
| `machineId`    | `string`   | Machine connector identity                         |
| `capabilities` | `string[]` | Fine-grained capability keys                       |

## Enforcement rules

1. Tokens **must** contain a non-empty `workspaceId` or `tenantId` — rejection is
   mandatory for tokens without workspace scope.
2. Roles **must** be a non-empty array of valid `WorkspaceUserRole` values, with no
   duplicates.
3. `workspaceId` takes precedence over `tenantId` when both are present.
4. The parser throws `JwtClaimValidationError` for any structural violation.

## Consequences

- Every Portarium token consumer uses `parsePortariumJwtClaims` for uniform claim
  extraction.
- Workspace scoping is guaranteed by construction — no handler can accidentally
  operate outside its tenant boundary.
- The optional `agentId` and `machineId` claims enable resource-level authorization
  checks introduced in bead-0670.
