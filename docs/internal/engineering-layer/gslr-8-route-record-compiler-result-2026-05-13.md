# GSLR-8 Route-Record Compiler Result: 2026-05-13

Status: R&D boundary, static projection candidate only  
Tracking bead: `bead-1248`  
Companion prompt-language bead: `prompt-language-gslr23`

## Decision

Portarium can treat the exact GSLR-8 route-record compiler scaffold as positive
R&D evidence for a future static engineering evidence-card projection.

Do not build runtime ingestion yet.

GSLR-8 passed because Prompt Language owned the invariants that GSLR-7 left to
the local model:

- normalized policy tables;
- route decision;
- `selectedRoute` envelope;
- stable escalation ordering;
- artifact-ref rejection rules.

The local model filled only two generic predicate hooks.

## Evidence

Prompt-language added GSLR-8:

- route-record compiler fixture;
- public gate;
- private oracle;
- deterministic lane;
- local lane;
- fake-live result;
- three live local repeats.

All three live local repeats passed with zero frontier tokens.

| Run            | Final verdict | Private oracle | Frontier tokens |
| -------------- | ------------- | -------------- | --------------- |
| local repeat 1 | `pass`        | `pass`         | `0`             |
| local repeat 2 | `pass`        | `pass`         | `0`             |
| local repeat 3 | `pass`        | `pass`         | `0`             |

## Portarium Meaning

This is the first route-record result that can inform a product-facing static
card shape.

The unlocked next step is narrow:

```text
Create a docs/test-only static engineering evidence-card projection from
checked-in prompt-language route-policy evidence.
```

The blocked steps remain:

- live GSLR manifest ingestion;
- live Cockpit engineering cards from prompt-language runs;
- queues or database tables for route records;
- runtime policy decisions based on prompt-language manifests;
- MC connector observation or school-data movement.

## Sources

- Prompt-language GSLR-8 runbook:
  `experiments/harness-arena/GSLR-8-ROUTE-RECORD-COMPILER-RUNBOOK.md`
- Prompt-language GSLR-8 fake-live result:
  `experiments/harness-arena/results/gslr8-fake-live-2026-05-13/report.md`
- Prompt-language GSLR-8 local result:
  `experiments/harness-arena/results/gslr8-local-repeat-2026-05-13/report.md`
- Prompt-language post-GSLR-8 decision:
  `docs/evaluation/2026-05-13-post-gslr8-route-record-compiler-decision.md`

## Execution Record

2026-05-13:

- Recorded GSLR-8 as a positive local-screen result for exact PL-owned
  route-record compiler scaffolds.
- Unblocked only the next static evidence-card projection candidate.
- Kept runtime ingestion, live Cockpit cards, route-record persistence, and MC
  connector work blocked.
