# Port v1 (Port registry contract)

## Purpose

`Port` is the typed registration model for capability-bound external capability families and how each workspace maps to implementations.

This is the parser surface in `src/domain/ports/port-v1.ts`.

## Schema (`PortV1`)

- `schemaVersion`: `1`
- `portId`: branded `PortId`
- `workspaceId`: branded `WorkspaceId`
- `adapterId`: branded `AdapterId`
- `portFamily`: `PortFamily`
- `name`: non-empty string
- `status`: `Active` | `Inactive` | `Disabled`
- `supportedOperations`: non-empty array of non-empty strings with no duplicates
- `supportedOperations`: must be capability tokens in `<noun>:<action>` format (e.g., `invoice:read`)
- `supportedOperations` values must be valid for the selected `portFamily` and match the capability matrix defined in `docs/domain/port-taxonomy.md`
- `endpoint?`: optional non-empty string
- `auth?`: optional object
  - `mode`: `none` | `apiKey` | `basic` | `oauth2` | `serviceAccount` | `mTLS`
  - `scopes?`: optional array of non-empty strings with no duplicates
- `createdAtIso`: ISO timestamp string
- `updatedAtIso?`: optional ISO timestamp string

## FinanceAccounting Adapter Foundation (bead-0080)

- Application port contract now includes `FinanceAccountingAdapterPort` under
  `src/application/ports/finance-accounting-adapter.ts`.
- The operation set is fixed to the 16 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `FinanceAccounting` family.
- Execute response contract:
  - success: canonical `Account[]`, `Account`, `Invoice[]`, `Invoice`, `Party[]`,
    `Party`, `accepted`, or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/finance-accounting/in-memory-finance-accounting-adapter.ts`.

## PaymentsBilling Adapter Foundation (bead-0084)

- Application port contract now includes `PaymentsBillingAdapterPort` under
  `src/application/ports/payments-billing-adapter.ts`.
- The operation set is fixed to the 15 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `PaymentsBilling` family.
- Execute response contract:
  - success: canonical `Payment`, `Payment[]`, `Subscription`, `Subscription[]`,
    `Invoice`, `Invoice[]`, `Account`, `ExternalObjectRef`, `ExternalObjectRef[]`,
    `accepted`, or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/payments-billing/in-memory-payments-billing-adapter.ts`.
