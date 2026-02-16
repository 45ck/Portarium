# Stripe

- Provider ID: `stripe`
- Port Families: `PaymentsBilling`
- Upstream: `https://github.com/stripe/openapi`
- Pinned commit: `2e9f84824b511eeb0d70b873e06f2f5f1ea94e98`

## What To Extract Next

- Expand CIF entity coverage beyond `Customer`, `Invoice`, `PaymentIntent`, `Subscription`, `Product`.
- Capture more action surfaces relevant to VAOP planning (refunds, invoice finalisation/voiding, subscription updates).
- Capture webhook event taxonomy and which entities each event implies.

## Mapping Notes (Canonical)

- `Customer` likely maps to `Party` (role: `customer`).
- Provider-native objects with weak cross-provider overlap should stay as `ExternalObjectRef` with deep links.

## Capability Matrix Notes

- Idempotency via `Idempotency-Key` header is first-class; record which actions support it.
- Diff/plan support is likely partial (depends on endpoint); do not over-promise predicted effects.

## Open Questions

- Which actions have reliable dry-run semantics (if any) vs only verified effects post-write?
