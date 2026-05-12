# GSLR-3 Live Result: 2026-05-12

Status: R&D evidence record, not product integration
Tracking bead: `bead-1237`
Companion prompt-language bead: `prompt-language-gslr12`

## Decision

Do not build Portarium runtime ingestion yet.

Do not build live Cockpit evidence cards yet.

GSLR-3 is now a `frontier-baseline` task shape, not a local-screen promotion.

## What Happened

Prompt-language ran the GSLR-3 policy-manifest-to-static-evidence-card transform
fixture through the live sequence agreed after the post-GSLR-3 decision:

| Arm             | Result | Product meaning                                                      |
| --------------- | ------ | -------------------------------------------------------------------- |
| `local-only`    | fail   | Local model accepted an array manifest as valid                      |
| `advisor-only`  | fail   | Frontier advice helped, but local still miscounted local wall time   |
| `frontier-only` | pass   | Frontier model passed public gate, private oracle, and final verdict |

The frontier-only baseline used 33,913 frontier tokens and passed the private
oracle.

## Interpretation For Portarium

The evidence-card transform is product-relevant, but not local-ready.

The key design lesson still holds:

```text
blocked evidence must still become a blocked card
```

But the current implementation route for that transform should be frontier
baseline. The transform has enough semantic edges that local-only and
advisor-only failed under the current lane prompts.

## Product Boundary

Runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

No production Portarium service should consume prompt-language manifests yet.

A docs/test-only static evidence-card schema is now reasonable follow-on work,
but it must assume a frontier-baseline transform route until new local evidence
exists.

## Sources

- Prompt-language live result:
  `experiments/harness-arena/results/gslr3-live-2026-05-12/report.md`
- Prompt-language route policy:
  `experiments/harness-arena/gslr-policy-schema-routing-policy.v1.json`
- Prompt-language GSLR-3 runbook:
  `experiments/harness-arena/GSLR-3-POLICY-MANIFEST-TRANSFORM-RUNBOOK.md`

## Execution Record

2026-05-12:

- Created and closed `bead-1237`.
- Recorded the live GSLR-3 result and route-policy boundary.
- Kept runtime ingestion and live Cockpit evidence-card work blocked.
