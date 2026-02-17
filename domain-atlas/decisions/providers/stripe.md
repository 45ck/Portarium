# Stripe

- Provider ID: `stripe`
- Port Families: `PaymentsBilling`
- Upstream: `https://github.com/stripe/openapi`
- Pinned commit: `2e9f84824b511eeb0d70b873e06f2f5f1ea94e98`

## What To Extract Next

- Prefer `/latest/openapi.spec3.{json,yaml}` (GA) over `/openapi/` (legacy v1-only).
- Expand CIF entity coverage to include `Charge`, `Refund`, `Payout`, `BalanceTransaction`, `Price`, and `PaymentMethod`.
- Capture more action surfaces relevant to VAOP planning (PaymentIntent confirm/capture/cancel, refund creation, invoice finalisation/voiding, subscription updates).
- Capture webhook event taxonomy and which entities each event implies (OpenAPI does not enumerate all event types; likely needs a separate source).

## Mapping Notes (Canonical)

- `Customer` likely maps to `Party` (role: `customer`).
- Treat `Charge` as the primary `Payment` record; treat `Refund` and `Payout` as `Payment` subtypes (provider-native discrimination).
- Treat `PaymentIntent` as an orchestration object (use `ExternalObjectRef` unless/until VAOP introduces a canonical "payment attempt" concept).
- Provider-native objects with weak cross-provider overlap should stay as `ExternalObjectRef` with deep links.

## Capability Matrix Notes

- Idempotency via `Idempotency-Key` header is first-class; record which actions support it.
- Diff/plan support is likely partial (depends on endpoint); do not over-promise predicted effects.

## Open Questions

- Which actions have reliable dry-run semantics (if any) vs only verified effects post-write?
