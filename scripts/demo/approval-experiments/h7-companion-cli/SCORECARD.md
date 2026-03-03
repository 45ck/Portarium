# H7: companion approval CLI — Scorecard

| Criterion                | Score (1-5) | Notes |
|--------------------------|-------------|-------|
| Developer experience     | 5           | Separate CLI feels natural; explicit human intervention |
| Human UX                 | 4           | Familiar CLI UX; colorful output possible |
| Implementation simplicity| 3           | Two components (proxy + CLI); but each is simple |
| Production suitability   | 4           | CLI can run anywhere with network access to proxy |
| Works without extra infra| 5           | Pure Node.js stdlib |
| TOTAL                    | 21/25       |       |

Verdict: RECOMMENDED
Reason: Best developer experience — separate concerns cleanly. The CLI tool can be distributed independently. Scales to remote operations. Maps naturally to npm run demo:approve.
