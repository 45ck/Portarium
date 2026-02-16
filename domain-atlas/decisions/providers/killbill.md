# Kill Bill

- Provider ID: `killbill`
- Port Families: `PaymentsBilling`
- Upstream: `https://github.com/killbill/killbill`
- Pinned commit: `f7d48b5965cbc1d98805fea499f2e848bd021400`

## What To Extract Next

- Billing core: Account, Subscription, Bundle, Invoice, Payment, Refund, Credit.
- Subscription lifecycle states and how invoicing ties to entitlement.
- Idempotency semantics (where supported) and compensation patterns.

## Mapping Notes (Canonical)

- Account maps to `Party` + `ExternalObjectRef` (Kill Bill account vs canonical Party).
- Subscription/Invoice/Payment likely map directly to canonical objects with careful status mapping.

## Capability Matrix Notes

- Capture whether API supports previewing invoice changes before committing (plan/predicted effects).
- Identify which actions are reversible (refunds, credit adjustments) vs irreversible.

## Open Questions

- Which pieces of domain logic live in server vs are computed client-side?
