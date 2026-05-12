# GSLR-2 Live Result: 2026-05-12

Status: R&D evidence record, not product integration  
Tracking bead: `bead-1232`  
Companion prompt-language bead: `prompt-language-gslr7`

## Result

Prompt-language ran the hardened GSLR-2 policy-schema fixture across four live
arms:

| Arm             | Final verdict | Private oracle | Frontier tokens | Provider USD | Step wall time |
| --------------- | ------------- | -------------- | --------------- | ------------ | -------------- |
| `local-only`    | pass          | pass           | 0               | 0            | 60.548s        |
| `frontier-only` | pass          | pass           | 45,713          | 1            | 102.126s       |
| `advisor-only`  | pass          | pass           | 15,301          | 1            | 99.901s        |
| `hybrid-router` | pass          | pass           | 91,279          | 3            | 201.209s       |

The durable prompt-language report is:

```text
experiments/harness-arena/results/gslr2-live-2026-05-12/report.md
```

## Interpretation For Portarium

This is good evidence for bounded local implementation, not evidence that the
current hybrid route is cost-effective.

What changed:

- `qwen3-coder:30b` solved the hardened tiny schema validator with public and
  private gates.
- The advisor route also passed and used fewer frontier tokens than the
  frontier-only implementation route.
- The hybrid route passed, but classify plus final review cost more than
  frontier-only.

## Product Boundary

Do not build runtime ingestion yet.

Do not build a Cockpit evidence card that claims hybrid routing is proven.

The route-policy conclusion is narrower:

```text
For tiny one-file policy/schema validators with strong gates, local-only
screening is the current best route. Hybrid review is too expensive unless the
governance policy independently requires review.
```

## What To Do Next

Prompt-language should build a small family of GSLR-2-style fixtures before
Portarium product work:

- another one-file schema validator;
- a two-file validator plus test update;
- a small policy manifest transform;
- a deliberately adversarial raw-payload leakage case.

Portarium should wait for a route policy that can say when to use local-only,
advisor-only, or frontier review. The product card should show evidence and
route decisions only after that policy survives more than one fixture.

Follow-up on 2026-05-12: prompt-language codified the first route policy. The
exact GSLR-2 task is `local-screen`, not a broad local promotion and not a
hybrid-router success. Portarium should still keep runtime ingestion and Cockpit
evidence-card work blocked until the nearby fixture family produces more than
one clean route-policy datapoint.

## Execution Record

2026-05-12:

- Created and claimed `bead-1232`.
- Recorded the GSLR-2 live result and route-policy implication.
- Kept runtime ingestion and Cockpit product-card work blocked.
- Recorded the follow-up route-policy boundary: local-screen for the exact tiny
  schema task, with product ingestion still blocked.
