# Odoo (Community Edition)

- Provider ID: `odoo`
- Port Families: `FinanceAccounting`, `ProcurementSpend`
- Upstream: `https://github.com/odoo/odoo`
- Pinned commit: TBD (run `npm run domain-atlas:vendor -- --only odoo`)

## What To Extract Next

- Accounting objects (GL accounts, moves, move lines, payments, invoices/bills).
- Procurement objects (purchase orders, vendors/partners, receipts, RFQs).
- State machines for `account.move` and procurement docs (draft/posted/cancelled etc).

## Mapping Notes (Canonical)

- `res.partner` likely maps to `Party` with role tags (`customer`, `vendor`) depending on flags/usage.
- Many module-specific models remain `ExternalObjectRef` until proven cross-provider.

## Capability Matrix Notes

- Clarify idempotency strategy for create/update actions (external IDs? unique constraints?).
- Capture reversibility/compensation (refunds, cancels, voids) per action.

## Open Questions

- Best extraction source: ORM model definitions vs PostgreSQL schema vs XML data files?
