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

## bead-0892 Disposition

`bead-0892` audited original `stash@{30}` (current `stash@{11}` at audit time, stash object `0d9dfbd9`) and found that the bundle should not land wholesale on `main`:

- the low-fidelity Cockpit artifacts under `docs/ui/cockpit/` were preserved as a still-relevant direction, but they overlap with the already-open low-fi wireframe audit in `bead-0896` and should be handled there rather than duplicated here
- the current canonical parser surface is already implemented on `main`, but the bundle exposed a real follow-up gap: `.specify/specs/canonical-objects-v1.md` and `docs/domain/README.md` both still claim that `src/domain/canonical/objects-v1.ts` exists even though that compatibility module is absent on disk
- the bundle also contains still-distinct canonical parity utilities (`scripts/ci/check-canonical-parity.mjs`, `check-canonical-spec-parity.mjs`, `check-canonical-docs-parity.mjs`, and `canonical-parity-utils.mjs`) that may still be worth adapting to the current repo layout
- the reverse-loop governance utilities (`scripts/ci/check-reverse-loop-health.mjs`, `check-reverse-loop-dashboard.mjs`, and `check-open-beads.mjs`) remain distinct from `main`, but they need a focused audit against the current Beads workflow before adoption

The still-actionable survivors were split into focused follow-up beads instead of landing the historical bundle:

- `bead-0901` for reverse-loop health/dashboard and open-beads governance utilities
- `bead-0902` for `objects-v1.ts` compatibility drift and canonical parity checks

The remaining stash-only residue was explicitly discarded as obsolete historical carryover:

- bulk historical review-doc, backlog, and planning-note churn
- stale repo-tooling and dependency baseline edits bundled alongside the audit scripts
- duplicate canonical/domain scaffolding that is already superseded by the current parser-focused canonical surface on `main`

## bead-0893 Disposition

`bead-0893` audited original `stash@{32}` (current `stash@{12}` at audit time, stash object `9afbb5b6`) and found that the bundle mixed already-landed work, superseded historical variants, and two still-distinct follow-up areas:

- adapter registration, credential grants, and project parsing are already present on `main` under the current paths `src/domain/adapters/adapter-registration-v1.ts`, `src/domain/credentials/credential-grant-v1.ts`, and `src/domain/workspaces/project-v1.ts`
- the stash versions of those surfaces used older folder names and earlier contract shapes (`src/domain/adapter-registrations/`, `src/domain/credential-grants/`) and should not replace the current tree wholesale
- the stash `runtime-truth-v1` model is superseded by the ADR-0037 implementation already on `main` in `src/domain/deployment/definition-truth-v1.ts`
- the stash `port-contract.ts` surface is superseded by the current split between `src/domain/ports/port-family-capabilities-v1.ts` and the capability matrix already embedded in `src/domain/adapters/adapter-registration-v1.ts`
- two still-distinct gaps remain outside the current tree: evidence-governance parsers plus evidence retention/legal-hold/disposition control-plane contracts, and machine-invocation parser plus invocation status/stream control-plane contracts

The still-actionable survivors were split into focused follow-up beads instead of landing the historical bundle:

- `bead-0903` for evidence retention, legal-hold, and disposition domain/control-plane carryover
- `bead-0904` for machine invocation parser and invocation status/stream contract carryover

The remaining stash-only residue was explicitly discarded as superseded historical carryover:

- older OpenAPI/spec rewrites for adapter registration, credential grants, and projects that are already represented on `main`
- legacy folder-layout churn in `src/domain/index.ts` and related barrels
- duplicate runtime-truth and port-contract concepts that would conflict with the current deployment-truth and port-capability surfaces

## bead-0894 Disposition

`bead-0894` audited original `stash@{33}` (current `stash@{12}` at audit time, stash object `4d0bf39f`) and found that the bundle is fully superseded on `main`:

- the stash points the OpenFGA upstream submodule at `https://github.com/openfga/openfga`, but the current repo intentionally vendors `https://github.com/openfga/api` in `.gitmodules` and the current Domain Atlas extraction/docs already reference that API/protobuf source of truth
- the stash OpenAPI bundle is an older control-plane snapshot whose approval path, route set, and contract coverage have been superseded by the current `docs/spec/openapi/portarium-control-plane.v1.yaml`
- the stash primitive and primitive-test deltas are also historical snapshots and would remove or rename newer branded IDs, alias guards, and port-family coverage already present on `main`
- the stash `src/domain/canonical/index.ts` delta only reflects an older canonical export surface that is already exceeded by the current barrel
- the stash `src/infrastructure/openapi/openapi-contract.test.ts` content is an older contract test shape that has been superseded by the current split helper-based test suite and broader schema coverage

No still-distinct implementation or contract work remained after the audit, so no follow-up bead was created from this bundle.

The remaining stash-only residue was explicitly discarded as obsolete carryover:

- the old OpenFGA submodule target
- the stale control-plane OpenAPI snapshot and approval-path naming
- historical primitive/test snapshots that predate the current domain and OpenAPI contract surface

## bead-0895 Disposition

`bead-0895` audited original `stash@{40}` (current `stash@{12}` at audit time, stash object `7ec899b1`) and found that the bundle is fully superseded on `main`:

- the Zammad Domain Atlas assets from the stash are already present on `main`, including `domain-atlas/capabilities/zammad/CustomerSupport.capability-matrix.json`, `domain-atlas/decisions/providers/zammad.md`, `domain-atlas/extracted/zammad/cif.json`, `domain-atlas/mappings/zammad/CustomerSupport.mapping.json`, and `scripts/domain-atlas/extract-zammad-cif.mjs`
- the only material Zammad source delta left in the stash is an older `domain-atlas/sources/zammad/source.json` snapshot that still referenced `app/assets/javascripts/app/views/api.jst.eco` in `modelSources` and lacked the current tracking metadata already recorded on `main`
- the stash `src/domain/approvals/approval-v1.ts` and `src/domain/workflows/workflow-v1.ts` parsers are older snapshots that predate the current parse-utils integration, approval escalation-chain support, capability-aware workflow parsing, schema-version `2` workflow support, and stricter date/operation validation already implemented on `main`
- the stash approval/workflow tests are likewise older than the current domain regression coverage and would remove newer validation cases already exercised on `main`
- the stash specs `.specify/specs/approval-v1.md` and `.specify/specs/workflow-v1.md` are already preserved on `main`

No still-distinct integration, domain, or contract work remained after the audit, so no follow-up bead was created from this bundle.

The remaining stash-only residue was explicitly discarded as obsolete carryover:

- the older Zammad source metadata snapshot
- historical approval/workflow parser and test snapshots that would regress current domain validation coverage
- bundled historical `.ci/gate-baseline.json`, `package.json`, `research.json`, and tracker churn

## bead-0896 Disposition

`bead-0896` audited original `stash@{42}` (current `stash@{12}` at audit time, stash object `3c0bf1a6`) and found that the bundle is fully superseded on `main`:

- the low-fidelity Cockpit artifact from the stash is already preserved on `main` under `docs/internal/ui/lofi/`, including `index.html`, `README.md`, `wireframe.css`, and `wireframe.js`; the stash path `docs/ui/lofi/index.html` reflects an older pre-move location
- the stash `src/domain/runs/run-v1.ts` and `src/domain/runs/run-v1.test.ts` snapshots are older than the current run parser on `main` and would remove the parse-utils integration plus the newer timestamp ordering and ISO validation already covered in the active test suite
- the stash `src/domain/index.ts` and `src/domain/runs/index.ts` deltas are historical barrel snapshots already exceeded by the current export surface on `main`
- the bundled `domain-atlas/sources/mautic/source.json` and `domain-atlas/sources/vault/source.json` edits are older source-metadata snapshots that predate the current tracking metadata and current Vault source status on `main`

No still-distinct UI, domain, or documentation work remained after the audit, so no follow-up bead was created from this bundle.

The remaining stash-only residue was explicitly discarded as obsolete carryover:

- the pre-move `docs/ui/lofi/` path
- historical `run-v1` parser and test snapshots that would regress current run validation behavior
- bundled `research.json`, tracker churn, and older Domain Atlas source metadata

## bead-0897 Disposition

`bead-0897` audited the preserved bead-0195 pass-series bundle from original `stash@{16}`, `stash@{18}`-`stash@{20}`, and `stash@{22}`-`stash@{27}`. By the time of audit, the surviving local copies were the current `stash@{8}` through `stash@{0}` entries (`d9d12c30`, `025a3278`, `62cc3bc1`, `c11c758d`, `84a22703`, `1b1c14d6`, `3f248430`, `b8f676d8`, and `00d258d6`), while the original `stash@{21}` slot had already been dropped during `bead-0884` because it had no remaining payload.

The bundle is fully superseded on `main`:

- the `PageHeader` icon carryover from the route-focused pass stashes is already preserved on `main`, and the active Cockpit routes now apply it more broadly than the historical snapshots across runs, work items, workforce, approvals, evidence, agents, dashboard, and other route surfaces
- the root-nav carryover from the pass-series bundle is already preserved on `main` in `apps/cockpit/src/routes/__root.tsx`, including entity-icon navigation treatment and favicon/app-icon wiring
- the robotics fixtures, handlers, and `robots` page carried in the historical passes are already represented on `main`, but under a more evolved surface that uses the current robotics query/types stack and route structure instead of the older mock-only detail sheet snapshot
- the historical asset-manifest, asset-registry, asset-type, and icon-prompt carryover is already preserved on `main`; the stash versions are earlier snapshots of the same entity-asset expansion and icon-generation work
- the robot-context SoD policy-evaluation carryover in the pass bundle is already preserved on `main` and was closed independently by the later approval/SoD parity recovery work
- the `submit-map-command-intent` action/RBAC carryover bundled with one of the passes is already present on `main`

No still-distinct UI, asset, or policy gap remained after the audit, so no follow-up bead was created from this bundle.

The remaining stash-only residue was explicitly discarded as obsolete historical carryover:

- older Cockpit route snapshots that predate the current broader `PageHeader` icon rollout
- older robotics mock/demo snapshots that are narrower than the current robotics route and data surfaces on `main`
- earlier copies of the asset prompt/registry/type expansion that are already landed in the active Cockpit asset system
- bundled tracker churn in `.beads/issues.jsonl`

## bead-0898 Disposition

`bead-0898` audited original `stash@{31}` (current `stash@{0}` at audit time, stash object `dd6e1acc`) and found that the surviving payload is a historical canonical-seed closeout snapshot rather than a not-yet-landed domain scaffold or reverse-loop implementation branch:

- the stash contains canonical-seed adoption churn in `src/domain/testing/canonical-seeds-v1.test.ts`, query tests, and `src/infrastructure/openapi/openapi-contract.test.ts`, but those changes are already preserved on `main` and the active files now exceed the stash snapshot
- the stash review note `docs/review/bead-0193-canonical-e2e-seeds.md` points at a historical review-doc path that is no longer part of the active repo layout, so it is obsolete closeout residue rather than a missing adopted document
- the `.beads/issues.jsonl` delta is only a historical tracker snapshot showing older claim/close state for beads such as `bead-0523`, `bead-0558`, and `bead-0587`; it does not represent work that should be replayed onto the current tracker
- despite the bead title, the actual stash payload did not include still-distinct reverse-loop utilities or canonical scaffold files; those concerns had already been separated elsewhere in the stash audit trail and are not carried by this surviving bundle

No still-distinct canonical model, reverse-loop utility, or documentation gap remained after the audit, so no follow-up bead was created from this bundle.

The remaining stash-only residue was explicitly discarded as obsolete historical carryover:

- historical review-doc closeout text for `bead-0193`
- already-landed canonical-seed test/query/OpenAPI churn
- stale tracker claim-state snapshots in `.beads/issues.jsonl`

## bead-0901 Disposition

`bead-0901` audited the reverse-loop governance utilities from original `stash@{30}` (stash object `0d9dfbd9`) and found that they should not be adopted on `main` as written:

- `scripts/ci/check-open-beads.mjs` hard-fails whenever any bead is open, which conflicts with the current Beads workflow in `AGENT_LOOP.md` and `AGENTS.md`; the active repo expects open beads to exist during normal autonomous work, and the standard operator view is already covered by `npm run bd -- issue next --json` and `npm run bd -- issue list --json`
- `scripts/ci/check-reverse-loop-health.mjs` couples tracker state to canonical docs/spec parity checks via `canonical-parity-utils.mjs`; that parity work was already split into `bead-0902`, so reviving this combined health gate here would re-entangle scopes that were intentionally separated
- `scripts/ci/check-reverse-loop-dashboard.mjs` inherits both problems above and additionally depends on `scripts/ci/check-port-capability-parity.mjs`, which is absent on `main`; adopting the dashboard would therefore broaden this bead from a governance audit into a larger multi-script recovery bundle
- none of the reverse-loop commands are referenced by the current runbooks or CI entrypoints on `main`, so landing them now would introduce a second governance workflow alongside the current Beads-driven claim/finish loop

No reverse-loop utility from this bundle fit the current Beads workflow closely enough to justify recovery, so no script was restored and no further follow-up bead was created from this audit.

The remaining stash-only residue was explicitly discarded as obsolete governance carryover:

- the historical reverse-loop "no open beads" preflight gate
- the combined reverse-loop dashboard wrapper and its missing script dependencies
- the older combined canonical-parity-plus-closeout health check

## bead-0902 Disposition

`bead-0902` recovered the still-relevant canonical compatibility and parity work from original `stash@{30}` (stash object `0d9dfbd9`) and aligned it to the current parser surface on `main`:

- restored `src/domain/canonical/objects-v1.ts` as a compatibility-only barrel for canonical ID aliases, including the newer consent and privacy-policy IDs plus the current `FinancialAccountId` and `CanonicalTaskId` primitive names
- updated `src/domain/canonical/index.ts` to re-export the full current parser surface, including `consent-v1.ts` and `privacy-policy-v1.ts`, while keeping `objects-v1.ts` out of the main canonical barrel
- landed `scripts/ci/check-canonical-parity.mjs`, `check-canonical-spec-parity.mjs`, `check-canonical-docs-parity.mjs`, and `canonical-parity-utils.mjs`, then wired the umbrella check into `npm run ci:gates`
- added regression coverage for the compatibility barrel, canonical parser barrel, and parity scripts
- reconciled `.specify/specs/canonical-objects-v1.md`, `docs/domain/canonical-objects.md`, and the canonical subsection of `docs/domain/README.md` to the current 16-member canonical set (15 canonical entity parsers plus `ExternalObjectRef`)

The remaining stash-only residue was explicitly discarded as obsolete historical carryover:

- the older reverse-loop and dashboard utilities already rejected by `bead-0901`
- stale historical review-doc residue that did not affect the live canonical parser, spec, or docs surface

## bead-0903 Disposition

`bead-0903` recovered the still-relevant evidence-governance contract carryover from original `stash@{32}` (stash object `9afbb5b6`) and aligned it to the current evidence durability model on `main`:

- restored `src/domain/evidence/evidence-governance-v1.ts` plus regression coverage for retention-schedule, legal-hold, and disposition parsing without replacing the lower-level `retention-schedule-v1.ts` artifact-retention surface already used by runs and payload stores
- re-exported the recovered parser module from `src/domain/evidence/index.ts` so the evidence governance contracts are part of the current domain barrel again
- restored the control-plane OpenAPI surfaces for evidence retention schedules, evidence disposition execution, and legal-hold lifecycle operations, together with schema coverage in the OpenAPI contract test suite and operation-id golden fixture
- updated `.specify/specs/evidence-retention-policy-v1.md` to record these governance endpoints explicitly as control-plane surfaces that complement, rather than replace, the existing WORM/legal-hold durability semantics

The remaining stash-only residue was explicitly discarded as obsolete historical carryover:

- any implication that the governance parser should replace the current `RetentionScheduleV1` payload-store contract
- the broader historical stash bundle outside the recovered evidence governance parser and control-plane contract surfaces
