# Bead-0086: PaymentsBilling Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/payments-billing/in-memory-payments-billing-adapter.integration.test.ts`

## Test Coverage Added

- Charge flow: create/get/refund/list.
- Subscription flow: create/get/cancel/list.
- Invoice flow: create/get/list plus `getBalance`.
- Payment method flow: list/get plus `createPayout`.

## Verification

- `npm run test -- src/infrastructure/adapters/payments-billing/in-memory-payments-billing-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` still fails at the pre-existing gate baseline mismatch before later stages execute.
