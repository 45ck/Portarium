# H4: WebSocket channel — Scorecard

| Criterion                | Score (1-5) | Notes |
|--------------------------|-------------|-------|
| Developer experience     | 2           | WebSocket framing is complex without a library |
| Human UX                 | 5           | Real-time bidirectional; best UX |
| Implementation simplicity| 1           | RFC 6455 framing is 150+ lines without ws package |
| Production suitability   | 4           | Excellent for dashboards; requires WS-aware proxies |
| Works without extra infra| 4           | Node.js built-in but complex implementation |
| TOTAL                    | 16/25       |       |

Verdict: NOT RECOMMENDED
Reason: The UX is excellent but implementation complexity is prohibitive without a WebSocket library. The plugin becomes a liability to maintain.
