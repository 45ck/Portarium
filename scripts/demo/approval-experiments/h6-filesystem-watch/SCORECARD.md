# H6: filesystem watch — Scorecard

| Criterion                 | Score (1-5) | Notes                                                   |
| ------------------------- | ----------- | ------------------------------------------------------- |
| Developer experience      | 3           | Filesystem paths are non-obvious; cross-platform quirks |
| Human UX                  | 2           | Operator must create a file; awkward without tooling    |
| Implementation simplicity | 4           | fs.watch is built-in; ~60 lines                         |
| Production suitability    | 2           | Doesn't work across network; tmpdir isolation issues    |
| Works without extra infra | 5           | Pure Node.js stdlib                                     |
| TOTAL                     | 16/25       |                                                         |

Verdict: NOT RECOMMENDED
Reason: Works only on a single machine. Operator UX is confusing. fs.watch has known reliability issues on Windows. Good for local dev tooling only.
