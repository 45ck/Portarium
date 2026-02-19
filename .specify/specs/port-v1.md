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

## ProcurementSpend Adapter Foundation (bead-0088)

- Application port contract now includes `ProcurementSpendAdapterPort` under
  `src/application/ports/procurement-spend-adapter.ts`.
- The operation set is fixed to the 14 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `ProcurementSpend` family.
- Execute response contract:
  - success: canonical `Order`, `Order[]`, `Party`, `Party[]`, `Subscription`,
    `Subscription[]`, `ExternalObjectRef`, `ExternalObjectRef[]`, `accepted`,
    or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/procurement-spend/in-memory-procurement-spend-adapter.ts`.

## HrisHcm Adapter Foundation (bead-0092)

- Application port contract now includes `HrisHcmAdapterPort` under
  `src/application/ports/hris-hcm-adapter.ts`.
- The operation set is fixed to the 12 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `HrisHcm` family.
- Execute response contract:
  - success: canonical `Party`, `Party[]`, `Subscription[]`, `ExternalObjectRef`,
    `ExternalObjectRef[]`, `accepted`, or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/hris-hcm/in-memory-hris-hcm-adapter.ts`.

## Payroll Adapter Foundation (bead-0096)

- Application port contract now includes `PayrollAdapterPort` under
  `src/application/ports/payroll-adapter.ts`.
- The operation set is fixed to the 12 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `Payroll` family.
- Execute response contract:
  - success: `ExternalObjectRef`, `ExternalObjectRef[]`, `Payment`, `Payment[]`,
    `accepted`, or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/payroll/in-memory-payroll-adapter.ts`.

## CrmSales Adapter Foundation (bead-0100)

- Application port contract now includes `CrmSalesAdapterPort` under
  `src/application/ports/crm-sales-adapter.ts`.
- The operation set is fixed to the 16 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `CrmSales` family.
- Execute response contract:
  - success: canonical `Party`, `Party[]`, `Opportunity`, `Opportunity[]`, `Task`,
    `Task[]`, `Document`, `Document[]`, `ExternalObjectRef[]`, `accepted`,
    or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/crm-sales/in-memory-crm-sales-adapter.ts`.

## CustomerSupport Adapter Foundation (bead-0104)

- Application port contract now includes `CustomerSupportAdapterPort` under
  `src/application/ports/customer-support-adapter.ts`.
- The operation set is fixed to the 15 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `CustomerSupport` family.
- Execute response contract:
  - success: canonical `Ticket`, `Ticket[]`, `Party[]`, `Document`, `Document[]`,
    `ExternalObjectRef`, `ExternalObjectRef[]`, `accepted`, or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/customer-support/in-memory-customer-support-adapter.ts`.

## ItsmItOps Adapter Foundation (bead-0108)

- Application port contract now includes `ItsmItOpsAdapterPort` under
  `src/application/ports/itsm-it-ops-adapter.ts`.
- The operation set is fixed to the 17 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `ItsmItOps` family.
- Execute response contract:
  - success: canonical `Ticket`, `Ticket[]`, `Asset`, `Asset[]`, `Party`,
    `Party[]`, `Document`, `Document[]`, `Subscription`, `Subscription[]`,
    `Product`, `Product[]`, `ExternalObjectRef`, `ExternalObjectRef[]`,
    `accepted`, or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/itsm-it-ops/in-memory-itsm-it-ops-adapter.ts`.

## IamDirectory Adapter Foundation (bead-0112)

- Application port contract now includes `IamDirectoryAdapterPort` under
  `src/application/ports/iam-directory-adapter.ts`.
- The operation set is fixed to the 18 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `IamDirectory` family.
- Execute response contract:
  - success: canonical `Party`, `Party[]`, `Asset`, `Asset[]`,
    `ExternalObjectRef`, `ExternalObjectRef[]`, `accepted`, or `opaque`
    result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/iam-directory/in-memory-iam-directory-adapter.ts`.

## SecretsVaulting Adapter Foundation (bead-0116)

- Application port contract now includes `SecretsVaultingAdapterPort` under
  `src/application/ports/secrets-vaulting-adapter.ts`.
- The operation set is fixed to the 15 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `SecretsVaulting` family.
- Execute response contract:
  - success: `ExternalObjectRef`, `ExternalObjectRef[]`, `accepted`, or `opaque`
    result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/secrets-vaulting/in-memory-secrets-vaulting-adapter.ts`.

## MarketingAutomation Adapter Foundation (bead-0120)

- Application port contract now includes `MarketingAutomationAdapterPort` under
  `src/application/ports/marketing-automation-adapter.ts`.
- The operation set is fixed to the 18 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `MarketingAutomation` family.
- Execute response contract:
  - success: canonical `Party`, `Party[]`, `Campaign`, `Campaign[]`,
    `ExternalObjectRef`, `ExternalObjectRef[]`, `accepted`, or `opaque`
    result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/marketing-automation/in-memory-marketing-automation-adapter.ts`.

## AdsPlatforms Adapter Foundation (bead-0124)

- Application port contract now includes `AdsPlatformsAdapterPort` under
  `src/application/ports/ads-platforms-adapter.ts`.
- The operation set is fixed to the 19 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `AdsPlatforms` family.
- Execute response contract:
  - success: canonical `Campaign`, `Campaign[]`, `ExternalObjectRef`,
    `ExternalObjectRef[]`, `accepted`, or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/ads-platforms/in-memory-ads-platforms-adapter.ts`.

## CommsCollaboration Adapter Foundation (bead-0128)

- Application port contract now includes `CommsCollaborationAdapterPort` under
  `src/application/ports/comms-collaboration-adapter.ts`.
- The operation set is fixed to the 19 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `CommsCollaboration` family.
- Execute response contract:
  - success: canonical `Party`, `Party[]`, `CanonicalTaskV1`, `CanonicalTaskV1[]`,
    `Document`, `Document[]`, `ExternalObjectRef`, `ExternalObjectRef[]`,
    `accepted`, or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/comms-collaboration/in-memory-comms-collaboration-adapter.ts`.

## ProjectsWorkMgmt Adapter Foundation (bead-0132)

- Application port contract now includes `ProjectsWorkMgmtAdapterPort` under
  `src/application/ports/projects-work-mgmt-adapter.ts`.
- The operation set is fixed to the 21 taxonomy operations in
  `docs/domain/port-taxonomy.md` for the `ProjectsWorkMgmt` family.
- Execute response contract:
  - success: canonical `Task`, `Task[]`, `ExternalObjectRef`,
    `ExternalObjectRef[]`, `accepted`, or `opaque` result variants;
  - failure: `unsupported_operation`, `not_found`, `validation_error`, `provider_error`.
- Infrastructure baseline includes an in-memory adapter implementation for
  deterministic tests and local development:
  `src/infrastructure/adapters/projects-work-mgmt/in-memory-projects-work-mgmt-adapter.ts`.
