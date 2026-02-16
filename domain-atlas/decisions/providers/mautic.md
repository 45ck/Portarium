# Mautic

- Provider ID: `mautic`
- Port Families: `MarketingAutomation`
- Upstream: `https://github.com/mautic/mautic`
- Pinned commit: `e3ac0d4d7e8d17034d56cb21bf5baab4f353a433`

## What To Extract Next

- Contact model, segments, campaigns, emails, forms, landing pages.
- Lifecycle: lead scoring, campaign membership, unsubscribes, suppression lists.
- Event hooks and webhook support posture.

## Mapping Notes (Canonical)

- Contacts map to `Party` with role `lead` (until converted).
- Campaign maps to canonical `Campaign` where overlap is strong.

## Capability Matrix Notes

- Identify which actions are idempotent and the right idempotency key strategy (if any).
- Clarify diff support: are there preview endpoints or only verified effects?

## Open Questions

- Best extraction source: REST API schema vs Doctrine entities + migrations?
