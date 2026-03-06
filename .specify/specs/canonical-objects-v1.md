# Canonical Objects v1 (Domain scaffold)

## Purpose

This document tracks the canonical object parser contracts that are implemented in-domain for Portarium v1.
Every object uses:

- `schemaVersion: 1`
- branded IDs from `src/domain/primitives/index.ts`
- tenant scoping via `tenantId`
- optional `externalRefs: ExternalObjectRef[]` where available for SoR-specific data

## Current v1 parser surface (15 canonical objects)

Canonical parser modules now implemented:

- `src/domain/canonical/party-v1.ts`
- `src/domain/canonical/ticket-v1.ts`
- `src/domain/canonical/invoice-v1.ts`
- `src/domain/canonical/payment-v1.ts`
- `src/domain/canonical/task-v1.ts`
- `src/domain/canonical/campaign-v1.ts`
- `src/domain/canonical/consent-v1.ts`
- `src/domain/canonical/asset-v1.ts`
- `src/domain/canonical/document-v1.ts`
- `src/domain/canonical/subscription-v1.ts`
- `src/domain/canonical/opportunity-v1.ts`
- `src/domain/canonical/product-v1.ts`
- `src/domain/canonical/order-v1.ts`
- `src/domain/canonical/account-v1.ts`
- `src/domain/canonical/privacy-policy-v1.ts`

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

- `src/domain/canonical/index.ts` exports every parser-focused module directly, including consent and privacy-policy parsers, and does **not** re-export legacy `objects-v1.ts`.
- The legacy `objects-v1.ts` remains available for direct imports only.

## Invariants and gating

- `src/domain/canonical/index.test.ts` asserts the canonical barrel contract.
- `src/domain/canonical/objects-v1.test.ts` asserts that the compatibility barrel exposes ID aliases only.
- Per-object parser tests in `src/domain/canonical/*-v1.test.ts` cover success/failure semantics for each v1 object.
- `scripts/ci/check-canonical-parity.mjs` enforces:
  - canonical parser inventory parity with `.specify/specs/canonical-objects-v1.md`
  - canonical parser inventory parity with `docs/domain/canonical-objects.md`
  - canonical barrel coverage parity in `src/domain/canonical/index.ts`
  - no `./objects-v1.js` re-export from the canonical barrel

## Delivery criteria

- `.specify/specs/canonical-objects-v1.md` reflects all canonical v1 parser types actually present in `src/domain/canonical`.
- New objects added to canonical must include parser and `parseXxxV1` tests.
