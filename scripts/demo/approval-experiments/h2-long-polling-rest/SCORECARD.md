# H2: long-polling REST — Scorecard

| Criterion                | Score (1–5) | Notes |
|--------------------------|-------------|-------|
| Developer experience     | 4           | Standard REST, easy to test with curl |
| Human UX                 | 3           | Operator uses separate API call; needs a UI wrapper |
| Implementation simplicity| 4           | ~80 lines, pure http module |
| Production suitability   | 4           | Battle-tested pattern; slight latency from polling interval |
| Works without extra infra| 5           | Pure Node.js stdlib |
| TOTAL                    | 20/25       |       |

Verdict: RECOMMENDED
Reason: Proven pattern, zero extra dependencies, operator can use any HTTP client. Polling interval adds 0-1s latency which is acceptable for human-in-the-loop approvals.
