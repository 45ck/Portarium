# H3: SSE push — Scorecard

| Criterion                 | Score (1-5) | Notes                                                                 |
| ------------------------- | ----------- | --------------------------------------------------------------------- |
| Developer experience      | 3           | SSE requires keeping connection open; slightly tricky reconnect logic |
| Human UX                  | 4           | Near-instant push; operator gets notified immediately                 |
| Implementation simplicity | 3           | ~100 lines; SSE framing + reconnect handling                          |
| Production suitability    | 4           | Good for browser clients; HTTP/1.1 connection limits                  |
| Works without extra infra | 5           | Pure Node.js stdlib                                                   |
| TOTAL                     | 19/25       |                                                                       |

Verdict: RECOMMENDED
Reason: Better UX than polling (instant push), still zero dependencies. Best suited when approvals are rendered in a browser.
