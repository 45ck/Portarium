# Legacy Stash Audit

Updated: 2026-03-06

This audit records the disposition of legacy repository stashes discovered during `bead-0884`.
Stash references below use the original numbering captured before cleanup on 2026-03-06.
Because `git stash drop` renumbers later entries, use this document as the source of truth for the preservation mapping rather than the post-cleanup `stash@{n}` labels.

## Preservation Path Created

The following stash entries were kept because they still appeared to contain meaningful unfinished work or required an explicit audit before disposal:

| Original stash                                                     | Preservation path | Notes                                                                  |
| ------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------- |
| `stash@{1}`                                                        | `bead-0888`       | Retrieval release-readiness and GTM onboarding carryover               |
| `stash@{3}`                                                        | `bead-0889`       | Ambient type stub hardening for AWS S3, gRPC, and Hono                 |
| `stash@{11}`                                                       | `bead-0890`       | Retry-chain, logger, and observability carryover                       |
| `stash@{16}`, `stash@{18}`-`stash@{20}`, `stash@{22}`-`stash@{27}` | `bead-0896`       | Historical Cockpit carryover from the bead-0195 pass series            |
| `stash@{28}`                                                       | `bead-0887`       | Robot-context SoD contract parity carryover                            |
| `stash@{30}`                                                       | `bead-0891`       | Large historical canonical parity and reverse-loop bundle              |
| `stash@{31}`                                                       | `bead-0897`       | Large historical domain scaffold and reverse-loop bundle               |
| `stash@{32}`                                                       | `bead-0892`       | Adapter registration, evidence governance, and runtime-truth carryover |
| `stash@{33}`                                                       | `bead-0893`       | OpenFGA and control-plane contract carryover                           |
| `stash@{40}`                                                       | `bead-0894`       | Zammad Domain Atlas plus approval/workflow domain carryover            |
| `stash@{42}`                                                       | `bead-0895`       | Low-fidelity Cockpit IA and run-model wireframes                       |

## Dropped As Disposable

The following stash entries were classified as disposable backups or superseded local residue and are safe to remove:

- `stash@{0}`
- `stash@{2}`
- `stash@{4}`
- `stash@{5}`
- `stash@{6}`
- `stash@{7}`
- `stash@{8}`
- `stash@{9}`
- `stash@{10}`
- `stash@{12}`
- `stash@{13}`
- `stash@{14}`
- `stash@{15}`
- `stash@{17}`
- `stash@{21}`
- `stash@{29}`
- `stash@{34}`
- `stash@{35}`
- `stash@{36}`
- `stash@{37}`
- `stash@{38}`
- `stash@{39}`
- `stash@{41}`

## Disposal Notes

- `stash@{15}` was minor retrieval router formatting churn already superseded on `main`.
- `stash@{17}` was an older Cockpit robotics missions tweak already superseded on `main`.
- `stash@{21}` had no remaining diff payload.
- `stash@{41}` was an early Zammad scaffold superseded by the larger preserved Zammad carryover in `stash@{40}`.

## Outcome

`bead-0884` should only close after:

- the preservation beads above exist in `.beads/issues.jsonl`
- the disposable stash entries above are dropped
- the remaining stash list is rechecked to confirm only explicitly preserved items are left
