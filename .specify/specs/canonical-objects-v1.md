# Canonical Objects v1 (Domain scaffold)

## Purpose

This document tracks the canonical object parser contracts that are implemented in-domain for VAOP v1.
Every object uses:

- `schemaVersion: 1`
- branded IDs from `src/domain/primitives/index.ts`
- tenant scoping via `tenantId`
- optional `externalRefs: ExternalObjectRef[]` where available for SoR-specific data

## Current v1 parser surface (12 canonical objects)

Canonical parser modules now implemented:

- `src/domain/canonical/party-v1.ts`
- `src/domain/canonical/ticket-v1.ts`
- `src/domain/canonical/invoice-v1.ts`
- `src/domain/canonical/payment-v1.ts`
- `src/domain/canonical/task-v1.ts`
- `src/domain/canonical/campaign-v1.ts`
- `src/domain/canonical/asset-v1.ts`
- `src/domain/canonical/document-v1.ts`
- `src/domain/canonical/subscription-v1.ts`
- `src/domain/canonical/opportunity-v1.ts`
- `src/domain/canonical/product-v1.ts`
- `src/domain/canonical/order-v1.ts`
- `src/domain/canonical/account-v1.ts`

Cross-cutting parser utility:

- `src/domain/canonical/external-object-ref.ts`

Legacy compatibility alias module:

- `objects-v1.ts`

`objects-v1.ts` provides canonical ID/type aliases for compatibility and does not export parser surfaces.

## Parser API contract

Each module exports:

- `<ObjectName>V1` type
- `parse<ObjectName>V1(input: unknown)`
- `<ObjectName>ParseError`

The canonical object barrel:

- `src/domain/canonical/index.ts` exports parser-focused modules directly and does **not** re-export legacy `objects-v1.ts`.
- The legacy `objects-v1.ts` remains available for direct imports only.

## Invariants and gating

- `src/domain/canonical/index.test.ts` asserts the canonical barrel contract.
- `src/domain/canonical/canonical-v1.test.ts` covers parser success/failure semantics for the v1 objects.
- `scripts/ci/check-canonical-exports.mjs` enforces:
  - no duplicate named declarations across canonical modules
  - no duplicate module re-exports in `src/domain/canonical/index.ts`
  - no `./objects-v1.js` re-export
  - no name collision with exported `src/domain/primitives/index.ts` symbols

## Delivery criteria

- `.specify/specs/canonical-objects-v1.md` reflects all canonical v1 parser types actually present in `src/domain/canonical`.
- New objects added to canonical must include parser and `parseXxxV1` tests.
