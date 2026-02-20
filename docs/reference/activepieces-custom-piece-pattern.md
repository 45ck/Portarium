# Activepieces Custom Piece Pattern

This reference defines the standard TypeScript npm package pattern for Portarium Activepieces custom pieces.

## Goals

- Reuse one package pattern across Port Families.
- Keep operation mapping explicit and versioned.
- Preserve traceability with `tenantId` and `correlationId` headers on every call path.

## Canonical Pattern

- Reusable parser + contract helpers:
  - `src/infrastructure/activepieces/activepieces-piece-package-pattern.ts`
- Example package scaffold:
  - `infra/activepieces/pieces/portarium-projects-work-mgmt-piece/package.json`
  - `infra/activepieces/pieces/portarium-projects-work-mgmt-piece/src/index.ts`

## Required Fields

- `schemaVersion`: currently `1`
- `packageName`: npm package identity
- `pieceName`: Activepieces piece identifier
- `portFamily`: Portarium Port Family
- `operations[]`: mapping from Portarium operation to Activepieces flow slug

Each operation mapping must provide:

- `operation`
- `displayName`
- `flowSlug`
- optional `requiresApproval`

## Header Propagation

Use the standard correlation headers:

- `tenantId`
- `correlationId`
- optional `runId`

Never drop these headers in piece execution wrappers.

## Copy Workflow

1. Copy `infra/activepieces/pieces/portarium-projects-work-mgmt-piece/`.
2. Rename package metadata and piece identifiers.
3. Replace operation mappings for the target Port Family.
4. Keep correlation headers contract unchanged.
