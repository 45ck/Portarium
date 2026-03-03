# H1: stdin prompt — Scorecard

| Criterion                | Score (1-5) | Notes |
|--------------------------|-------------|-------|
| Developer experience     | 4           | Zero deps, dead-simple to debug locally |
| Human UX                 | 2           | Terminal-only; no remote/async approval |
| Implementation simplicity| 5           | ~30 lines, readline built-in |
| Production suitability   | 1           | Blocks server thread; no remote operator support |
| Works without extra infra| 5           | Pure Node.js stdlib |
| TOTAL                    | 17/25       |       |

Verdict: VIABLE
Reason: Excellent for local dev/debug but fundamentally unsuitable for production (blocks server thread, requires terminal access, no remote operator support).
