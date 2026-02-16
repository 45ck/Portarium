# ERPNext

- Provider ID: `erpnext`
- Port Families: `FinanceAccounting`, `ProcurementSpend`
- Upstream: `https://github.com/frappe/erpnext`
- Pinned commit: TBD (run `npm run domain-atlas:vendor -- --only erpnext`)

## What To Extract Next

- DocTypes that represent the core financial/procurement workflows (invoices, payments, POs, suppliers).
- Lifecycle/state fields and which actions transition them.
- Permissions model relevant to mapping RBAC concepts.

## Mapping Notes (Canonical)

- Supplier/Customer likely map to `Party` with role tags.
- Financial artifacts with high variance should use `ExternalObjectRef` unless clearly canonical.

## Capability Matrix Notes

- Capture server-side workflow/approval engine semantics (who can do what, when).
- Clarify idempotency approach (naming series, external references).

## Open Questions

- Extraction approach: DocType JSON vs server-side model code?
