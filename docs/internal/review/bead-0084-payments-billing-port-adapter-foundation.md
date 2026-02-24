# Bead-0084: PaymentsBilling Port Adapter Foundation

## Scope

- `src/application/ports/payments-billing-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/payments-billing/in-memory-payments-billing-adapter.ts`
- `src/infrastructure/adapters/payments-billing/in-memory-payments-billing-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for PaymentsBilling operations with the
  15-operation union from the port taxonomy.
- Implemented an in-memory PaymentsBilling adapter foundation covering:
  - charge create/get/refund/list;
  - subscription create/get/cancel/list;
  - invoice create/get/list;
  - payment method get/list;
  - payout creation and balance retrieval;
  - validation, not-found, and unsupported-operation handling.
- Added barrel exports for application and infrastructure surfaces.

## Verification

- `npm run test -- src/infrastructure/adapters/payments-billing/in-memory-payments-billing-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
