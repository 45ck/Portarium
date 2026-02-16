# Port 2: Payments & Billing — Integration Catalog

## Port Operations

| Operation            | Description                                                       | Idempotent |
| -------------------- | ----------------------------------------------------------------- | ---------- |
| `createCharge`       | Initiate a one-time payment charge against a payment method       | No         |
| `getCharge`          | Retrieve a charge/transaction by canonical ID or external ref     | Yes        |
| `refundCharge`       | Issue a full or partial refund against an existing charge         | No         |
| `listCharges`        | Query charges with filters (status, date range, customer, amount) | Yes        |
| `createSubscription` | Enrol a customer into a recurring billing plan                    | No         |
| `getSubscription`    | Retrieve subscription details and current status                  | Yes        |
| `cancelSubscription` | Cancel an active subscription (immediate or end-of-period)        | No         |
| `listSubscriptions`  | List subscriptions filtered by customer, plan, or status          | Yes        |
| `createInvoice`      | Generate an invoice (one-time or subscription-triggered)          | No         |
| `getInvoice`         | Retrieve a single invoice by ID                                   | Yes        |
| `listInvoices`       | List invoices with filters and pagination                         | Yes        |
| `getPaymentMethod`   | Retrieve a stored payment method (card, bank account, wallet)     | Yes        |
| `listPaymentMethods` | List payment methods for a given customer                         | Yes        |
| `createPayout`       | Initiate a payout/transfer to a connected account or bank         | No         |
| `getBalance`         | Retrieve available and pending balance for the merchant account   | Yes        |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30 % market share or >50 k customers)

| Provider   | Source                                                                   | Adoption | Est. Customers                                  | API Style                                                     | Webhooks                                                                       | Key Entities                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------ | -------- | ----------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stripe** | S1 — comprehensive OpenAPI spec, test-mode sandbox with clock simulation | A1       | Millions of businesses across 46+ countries     | REST (JSON), versioned API (date-based), OAuth 2.0 / API keys | Yes — 200+ event types, signature verification, retry with exponential backoff | Charge, PaymentIntent, Subscription, Invoice, Customer, PaymentMethod, Payout, Refund, Plan, Price, Product, Coupon, Balance, BalanceTransaction, SetupIntent, Dispute |
| **PayPal** | S1 — OpenAPI spec, full sandbox environment                              | A1       | ~400 M active accounts, ~35 M merchant accounts | REST (JSON), OAuth 2.0 (client credentials)                   | Yes — webhook event types per product, signature verification                  | Payment, Order, Subscription, Invoice, Payout, Dispute, Plan, Product, BillingAgreement, Capture, Refund                                                               |

### Tier A2 — Strong Contenders (10-30 % share or >10 k customers)

| Provider                          | Source                                           | Adoption | Est. Customers                                 | API Style                                                                               | Webhooks                                              | Key Entities                                                                                               |
| --------------------------------- | ------------------------------------------------ | -------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Adyen**                         | S1 — OpenAPI specs per service, test environment | A2       | >10 k enterprise merchants (high-volume focus) | REST (JSON), API key auth, separate endpoints per service (Checkout, Payments, Payouts) | Yes — webhook notifications with HMAC, near-real-time | Payment, Refund, Payout, RecurringDetail, Split, Terminal, PaymentMethod, Dispute                          |
| **Square**                        | S1 — OpenAPI spec, sandbox with test values      | A2       | ~4 M sellers globally                          | REST (JSON), OAuth 2.0                                                                  | Yes — webhook event notifications                     | Payment, Order, Subscription, Invoice, Customer, Card, Refund, Payout, Catalog, Location                   |
| **Braintree** (PayPal subsidiary) | S1 — server SDKs with sandbox, GraphQL API       | A2       | Tens of thousands of merchants                 | REST + GraphQL, tokenised client/server architecture                                    | Yes — webhook notifications per event kind            | Transaction, Subscription, Customer, PaymentMethod, Dispute, Plan, Discount, Add-On, MerchantAccount       |
| **GoCardless**                    | S1 — REST API with sandbox, OpenAPI spec         | A2       | >85 k businesses (direct debit specialist)     | REST (JSON), OAuth 2.0 / access tokens                                                  | Yes — webhook events with signature verification      | Payment, Mandate, Subscription, Payout, PayoutItem, Refund, Customer, CustomerBankAccount, Creditor, Event |

### Best OSS for Domain Extraction

| Project                             | Source                                            | API Style                                             | Key Entities                                                                                                       | Notes                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kill Bill** (The Billing Project) | S1 — self-hosted, full REST API with Swagger spec | REST (JSON), plugin architecture for payment gateways | Account, Subscription, Bundle, Invoice, InvoiceItem, Payment, PaymentTransaction, Refund, Credit, Tag, CustomField | Open-source subscription billing and payments platform. Handles the full order-to-cash lifecycle. ~3.5 k GitHub stars. Excellent reference for canonical entity design. |

### Tier A3 — Established Niche

| Provider      | Source                                                  | Adoption | Notes                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chargebee** | S1 — REST API with full sandbox, OpenAPI spec available | A3       | Subscription billing specialist. Entities: Subscription, Customer, Invoice, CreditNote, Plan, Addon, Coupon, PaymentSource, Transaction, Order. Strong dunning and revenue-recognition features.                                 |
| **Recurly**   | S1 — REST API v3 with sandbox, client libraries         | A3       | Subscription billing and recurring revenue management. Entities: Subscription, Account, Invoice, Transaction, Plan, AddOn, Coupon, BillingInfo, ShippingAddress.                                                                 |
| **Paddle**    | S1 — REST API with sandbox, Paddle Billing (v2)         | A3       | Merchant-of-record for SaaS. Handles tax, compliance, and payouts. Entities: Transaction, Subscription, Product, Price, Customer, Discount, Payout, Adjustment. Simplifies entity model by owning the full billing relationship. |
| **Mollie**    | S1 — REST API with test mode, OpenAPI spec              | A3       | European payment focus (iDEAL, Bancontact, SEPA). Entities: Payment, Refund, Order, Subscription, Customer, Mandate, Settlement, Chargeback. Strong in Benelux and DACH.                                                         |

### Tier A4 — Emerging / Regional

| Provider                 | Source                                                | Adoption | Notes                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Razorpay** (India)     | S1 — REST API with test mode, extensive documentation | A4       | Dominant in Indian online payments. Entities: Payment, Order, Refund, Settlement, Invoice, Subscription, Plan, Customer, Fund Account, Transfer. Supports UPI, netbanking, and wallet methods.               |
| **Flutterwave** (Africa) | S1 — REST API with sandbox                            | A4       | Pan-African payments platform covering 30+ countries. Entities: Transaction, Transfer, Subaccount, PaymentPlan, Subscription, VirtualAccount, Bill. Supports mobile money, bank transfer, and card payments. |

---

## Universal Entity Catalog

Every entity type observed across all providers in this domain, grouped by functional area.

### Core Payment Objects

| Entity                   | Description                                                                                                                                                       | Observed In                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Charge / Transaction** | A single payment capture (one-time or against an invoice). Terminology varies: Stripe uses Charge/PaymentIntent, PayPal uses Payment/Capture, Adyen uses Payment. | All providers                                     |
| **PaymentIntent**        | A Stripe-originated concept representing the lifecycle of a payment from creation to confirmation. Some providers model this implicitly.                          | Stripe, (conceptually in Adyen Checkout)          |
| **Refund**               | A reversal of funds from a completed charge, full or partial.                                                                                                     | All providers                                     |
| **Payout / Transfer**    | Movement of funds from the platform balance to an external bank account or connected account.                                                                     | Stripe, PayPal, Adyen, Square, GoCardless, Paddle |

### Recurring Billing

| Entity                | Description                                                                                                             | Observed In                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Subscription**      | A recurring billing agreement linking a customer to a plan with a billing cycle.                                        | Stripe, PayPal, Square, GoCardless, Braintree, Kill Bill, Chargebee, Recurly, Paddle, Mollie        |
| **Plan / Price**      | The pricing definition (amount, interval, currency) that a subscription references. Stripe migrated from Plan to Price. | Stripe (Price), PayPal (Plan), Braintree (Plan), Chargebee (Plan), Recurly (Plan), Kill Bill (Plan) |
| **Coupon / Discount** | A reduction applied to a subscription or invoice (percentage or fixed amount, duration-limited).                        | Stripe, Braintree, Chargebee, Recurly, Paddle                                                       |
| **Invoice**           | An itemised bill generated for a subscription period or a one-time charge.                                              | Stripe, PayPal, Square, Kill Bill, Chargebee, Recurly, Paddle                                       |

### Customer & Payment Method

| Entity            | Description                                                                           | Observed In                                          |
| ----------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Customer**      | The billable party. May include contact details, tax IDs, and metadata.               | All providers                                        |
| **PaymentMethod** | A stored instrument (card, bank account, wallet token, SEPA mandate).                 | Stripe, Adyen, Square, Braintree, GoCardless, Mollie |
| **Mandate**       | An authorisation from a customer allowing direct debit collections (SEPA, BACS, ACH). | GoCardless, Mollie, Stripe (SEPA)                    |
| **BankAccount**   | A linked bank account used for direct debit or payouts.                               | GoCardless, Stripe, PayPal                           |

### Dispute & Risk

| Entity                   | Description                                                                                               | Observed In                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Dispute / Chargeback** | A customer-initiated reversal through their bank or card network. Includes evidence submission lifecycle. | Stripe, PayPal, Adyen, Braintree, Mollie |

### Platform & Marketplace

| Entity      | Description                                                     | Observed In                   |
| ----------- | --------------------------------------------------------------- | ----------------------------- |
| **Product** | A catalogue item that plans/prices are attached to.             | Stripe, PayPal, Paddle        |
| **Balance** | Available, pending, and reserved funds in the merchant account. | Stripe, PayPal, Adyen, Square |

---

## VAOP Canonical Mapping

| Universal Entity     | VAOP Canonical Object | Mapping Notes                                                                                                                                                                                                                                                      |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Charge / Transaction | `Payment`             | Direct mapping. VAOP `Payment` represents any completed funds movement. `status` field tracks lifecycle (pending, succeeded, failed). `provider_type` preserves whether this was a PaymentIntent, Charge, or Transaction in the source system.                     |
| PaymentIntent        | `Payment`             | Mapped to `Payment` with `status` reflecting the intent lifecycle (requires_payment_method, requires_confirmation, succeeded). Only materialised as a VAOP Payment once the intent reaches a terminal state, unless the caller explicitly queries pending intents. |
| Subscription         | `Subscription`        | Direct mapping. VAOP `Subscription` captures plan reference, billing cycle, status (trialing, active, past_due, cancelled), and anchor dates.                                                                                                                      |
| Invoice              | `Invoice`             | Direct mapping. Billing invoices map to the same `Invoice` canonical used in Port 1 (Finance). `source: billing` distinguishes from accounting invoices. Line items preserved.                                                                                     |
| Customer             | `Party`               | Mapped to `Party` with `role: customer`. Normalised contact fields (email, name, address). Provider-specific metadata stored in `ext` bag.                                                                                                                         |
| PaymentMethod        | `ExternalObjectRef`   | Payment methods are security-sensitive and highly provider-specific (tokenised card, SEPA mandate, wallet). Stored as typed external reference. VAOP never stores raw card numbers.                                                                                |
| Refund               | `Payment`             | Mapped to `Payment` with `type: refund` and a `parent_payment_id` linking to the original charge. Preserves partial-refund amounts.                                                                                                                                |
| Payout / Transfer    | `Payment`             | Mapped to `Payment` with `type: payout`. Destination is a bank account or connected account reference.                                                                                                                                                             |
| Dispute / Chargeback | `ExternalObjectRef`   | Disputes involve provider-specific evidence workflows and timelines. Stored as external reference with status tracking (needs_response, under_review, won, lost).                                                                                                  |
| Plan / Price         | `ExternalObjectRef`   | Pricing structures vary significantly (flat, tiered, metered, per-seat). Stored as typed external reference with structured metadata for amount, interval, and currency.                                                                                           |
| Product              | `Product`             | Direct mapping where applicable. VAOP `Product` is a lightweight catalogue record. Only populated when the billing provider exposes a product concept.                                                                                                             |
| Coupon / Discount    | `ExternalObjectRef`   | Discount logic is provider-specific (percent vs. fixed, duration, applicability rules). External reference with metadata.                                                                                                                                          |
| Balance              | `Account`             | Mapped to `Account` with `type: platform_balance`. Represents the merchant's available and pending funds. Read-only in most cases.                                                                                                                                 |
| Mandate              | `ExternalObjectRef`   | Direct-debit mandates are jurisdiction-specific (SEPA, BACS, ACH) with distinct lifecycle states. External reference preserves scheme-specific fields.                                                                                                             |
| BankAccount          | `ExternalObjectRef`   | Linked bank accounts stored as external reference. VAOP does not store full account numbers — only masked references and provider tokens.                                                                                                                          |

---

## Provider Authentication Summary

| Provider   | Auth Mechanism                                                   | Token Lifetime                    | Sandbox                                                                      | Rate Limits                                      |
| ---------- | ---------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| Stripe     | API keys (secret key + publishable key) or OAuth 2.0 for Connect | API keys do not expire            | Full test mode with `sk_test_` keys; test clocks for subscription simulation | 100 read / 100 write per second (burst-friendly) |
| PayPal     | OAuth 2.0 (client credentials grant)                             | Access: 9 hrs                     | Separate sandbox environment with test accounts                              | Varies by endpoint; general limit ~30 req/sec    |
| Adyen      | API key per environment + HMAC for webhooks                      | API keys do not expire            | Separate test environment with test card numbers                             | No published hard limit; contractual SLA         |
| Square     | OAuth 2.0 (authorization code)                                   | Access: 30 days, Refresh: rolling | Sandbox application IDs with test data                                       | 20-40 req/sec depending on endpoint              |
| Braintree  | API keys (public + private) per environment                      | Keys do not expire                | Full sandbox with pre-seeded test data                                       | No published limit; gateway-level throttling     |
| GoCardless | Access tokens (OAuth 2.0 or API key)                             | Access tokens: long-lived         | Sandbox environment with test bank details                                   | 1000 req/min                                     |

---

## Notes

- **Stripe** is the reference implementation for this port. Its API design, entity model, and webhook architecture heavily influenced the port operations and canonical mapping.
- **PayPal** coverage should include both the modern REST API (v2 Orders/Payments) and legacy NVP/SOAP for merchants that have not migrated. The adapter should normalise both to the same canonical output.
- The distinction between `Charge` and `PaymentIntent` is Stripe-specific. VAOP collapses both into `Payment` because downstream consumers care about the outcome (funds moved or not), not the provider's internal state machine.
- Subscription billing specialists (Chargebee, Recurly, Paddle) often sit in front of a payment gateway (Stripe, Braintree, Adyen). The VAOP adapter for these providers covers the billing/subscription layer; the underlying gateway may also be connected as a separate adapter for direct charge visibility.
- Regional providers (Razorpay, Flutterwave) are critical for customers operating in those markets. Their entity models are generally simpler than Stripe/PayPal but include region-specific payment methods (UPI, mobile money) that surface as `PaymentMethod` external references.
- **Webhook reliability** is critical for this port because payment state changes (succeeded, failed, disputed) are time-sensitive. All adapters must implement idempotent webhook handlers, signature verification, and a dead-letter queue for failed processing. Stripe's webhook retry schedule (up to 3 days with exponential backoff) is the benchmark.
- **PCI compliance** constrains what VAOP can store. No adapter should ever receive or persist raw card numbers (PAN). All payment method references must be provider-issued tokens. The `PaymentMethod` external reference stores only the token, last-four digits, expiry, and card brand.
- **Currency handling**: Stripe and most providers use smallest-currency-unit amounts (cents for USD, yen for JPY). The adapter must normalise to a consistent `amount` (integer in smallest unit) + `currency` (ISO 4217) pair and handle zero-decimal currencies correctly.
