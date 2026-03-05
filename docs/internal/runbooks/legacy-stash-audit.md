# Legacy Stash Audit

Updated: 2026-03-06

This audit records the disposition of legacy repository stashes discovered during `bead-0884`.
Stash references below use the original numbering captured before cleanup on 2026-03-06.
Because `git stash drop` renumbers later entries, use this document as the source of truth for the preservation mapping rather than the post-cleanup `stash@{n}` labels.

## Preservation Path Created

The first landing of `bead-0884` dropped the newly created follow-up beads during close.
`bead-0887` exists to repair that tracker regression and restore the preservation paths below on `main`.

The following stash entries were kept because they still appeared to contain meaningful unfinished work or required an explicit audit before disposal:

| Original stash                                                     | Preservation path | Notes                                                                  |
| ------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------- |
| `stash@{1}`                                                        | `bead-0889`       | Retrieval release-readiness and GTM onboarding carryover               |
| `stash@{3}`                                                        | `bead-0890`       | Ambient type stub hardening for AWS S3, gRPC, and Hono                 |
| `stash@{11}`                                                       | `bead-0891`       | Retry-chain, logger, and observability carryover                       |
| `stash@{16}`, `stash@{18}`-`stash@{20}`, `stash@{22}`-`stash@{27}` | `bead-0897`       | Historical Cockpit carryover from the bead-0195 pass series            |
| `stash@{28}`                                                       | `bead-0888`       | Robot-context SoD contract parity carryover                            |
| `stash@{30}`                                                       | `bead-0892`       | Large historical canonical parity and reverse-loop bundle              |
| `stash@{31}`                                                       | `bead-0898`       | Large historical domain scaffold and reverse-loop bundle               |
| `stash@{32}`                                                       | `bead-0893`       | Adapter registration, evidence governance, and runtime-truth carryover |
| `stash@{33}`                                                       | `bead-0894`       | OpenFGA and control-plane contract carryover                           |
| `stash@{40}`                                                       | `bead-0895`       | Zammad Domain Atlas plus approval/workflow domain carryover            |
| `stash@{42}`                                                       | `bead-0896`       | Low-fidelity Cockpit IA and run-model wireframes                       |

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

## bead-0888 Disposition

`bead-0888` recovers the still-relevant part of original `stash@{28}`:

- landed approval-submission parity for robot-context SoD by carrying `previousApproverIds` through `submitApproval`
- exposed `sodConstraints`, `previousApproverIds`, and `robotContext` on `DecideApprovalRequest` in the control-plane OpenAPI contract
- retained the existing `robotContext` name on `main` and explicitly discarded the stale `robotSodContext` alias from the original stash

## bead-0891 Disposition

`bead-0891` audited original `stash@{11}` (current `stash@{2}` at audit time, stash object `82661b9d`) and found that its still-relevant observability work was already preserved on `main`:

- retry-chain evidence hardening already exists in `src/infrastructure/evidence/robot-action-evidence-retry-chain.integration.test.ts`
- NATS publish span/error wrapping already exists in `src/infrastructure/eventing/nats-event-publisher.ts`
- logger and Prometheus registry hardening already exists in `src/infrastructure/observability/logger.ts` and `src/infrastructure/observability/prometheus-registry.ts`
- the observability runbook content lives on `main` at `docs/internal/runbooks/observability.md` rather than the older `docs/runbooks/observability.md` path from the stash

The remaining stash-only residue was obsolete and explicitly discarded:

- stale `package.json` / `package-lock.json` dependency churn
- stale `.ci/gate-baseline.json` content
- the pre-move `docs/runbooks/observability.md` path

## bead-0889 Disposition

`bead-0889` audited original `stash@{1}` (current `stash@{0}` at audit time, stash object `646e941a`) and found that its still-relevant adoption and retrieval release-readiness work was already preserved on `main`:

- the adoption GTM and retrieval release-readiness specs already exist on `main` at `.specify/specs/adoption-gtm-onboarding-v1.md` and `.specify/specs/retrieval-release-readiness-v1.md`
- the adoption docs already exist on `main` at `docs/adoption/adoption-ladder.md`, `docs/adoption/adoption-readiness-checklist.md`, and `docs/adoption/gtm-playbook.md`
- the retrieval release-readiness operator doc and regression test already exist on `main` at `docs/internal/governance/retrieval-release-readiness.md` and `src/infrastructure/adapters/retrieval-release-readiness.test.ts`
- the remaining stash diffs against those files were formatting-only or pointed at older pre-move paths such as `docs/governance/retrieval-release-readiness.md` and `docs/vertical-packs/authoring-guide.md`
- the stash copy of `docs/getting-started/hello-portarium.md` was explicitly discarded because it reflected older local setup commands, toolchain expectations, and port/healthcheck paths than the current repo workflow

The remaining stash-only residue was obsolete and explicitly discarded:

- stale `package.json` / `package-lock.json` dependency churn
- stale `.ci/gate-baseline.json`, `.gitignore`, `.beads/bead-linkage-map.json`, and `eslint.config.mjs` carryover

## bead-0890 Disposition

`bead-0890` audited original `stash@{3}` (current `stash@{0}` at audit time, stash object `6c9e740b`) and found that its ambient type-stub carryover was already superseded on `main`:

- the `src/types/aws-s3.d.ts` delta only renamed the intentionally unused `Command` output type parameter from `_Output` to `Output` and did not add any missing S3 surface area
- the `src/types/grpc.d.ts` delta only rewrote equivalent signatures such as `(string | Buffer)[]` to `Array<string | Buffer>` and `Record<string, unknown>` to an index-signature interface without expanding the supported gRPC API
- the `src/types/hono.d.ts` delta only converted `Env` and `Context` from interfaces to type aliases without adding missing request, response, or middleware members
- the bundled `.cspell/project-words.txt` carryover was older than `main` and would have discarded newer approved vocabulary and clarified comment groupings already present in the active wordlist

The remaining stash-only residue was obsolete and explicitly discarded:

- syntax-only ambient declaration churn in `src/types/aws-s3.d.ts`, `src/types/grpc.d.ts`, and `src/types/hono.d.ts`
- the older `.cspell/project-words.txt` snapshot
