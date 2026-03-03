# H5: HTML approval UI — Scorecard

| Criterion                | Score (1-5) | Notes |
|--------------------------|-------------|-------|
| Developer experience     | 4           | HTML UI is intuitive; built-in browser interaction |
| Human UX                 | 5           | Best non-technical UX; visual approve/deny |
| Implementation simplicity| 3           | HTML generation adds ~50 lines; polling still needed |
| Production suitability   | 3           | Good for internal tools; needs auth in production |
| Works without extra infra| 5           | Pure Node.js, inline HTML |
| TOTAL                    | 20/25       |       |

Verdict: RECOMMENDED
Reason: Best human UX for operators unfamiliar with CLI/API tools. Self-contained, zero deps. Pairs well with long-polling (H2) for the plugin side.
