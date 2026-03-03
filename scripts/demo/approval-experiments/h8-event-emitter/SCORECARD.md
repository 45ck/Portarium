# H8: in-process EventEmitter — Scorecard

| Criterion                 | Score (1-5) | Notes                                                         |
| ------------------------- | ----------- | ------------------------------------------------------------- |
| Developer experience      | 5           | Dead-simple for in-process use; familiar Node.js pattern      |
| Human UX                  | 1           | Requires programmatic handler; humans can't interact directly |
| Implementation simplicity | 5           | ~20 lines; EventEmitter is stdlib                             |
| Production suitability    | 2           | Only works in-process; breaks with any process isolation      |
| Works without extra infra | 5           | Pure Node.js stdlib                                           |
| TOTAL                     | 18/25       |                                                               |

Verdict: VIABLE
Reason: Excellent for testing and embedded scenarios but fundamentally limited to single-process deployments. Cannot support remote operators or multi-process proxy setups.
