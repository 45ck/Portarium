# Implementation Plan: WorkItem.kind + WorkRuntime Rollout

**Status:** Proposed
**Scope:** Landing strategy, PR slicing, migration sequencing, validation, and follow-up work after the Case/Change/Investigation work-model spec package.
**Related docs:**
- `docs/internal/specs/work-model-case-change-investigation.md`
- `docs/adr/0066-work-runtime-canonical-name-and-boundaries.md`
- `.specify/specs/work-item-v2.md`
- `.specify/specs/control-plane-api-v1-work-item-kind-addendum.md`
- `docs/integration/work-item-kind-api-contract-alignment.md`
- `docs/spec/openapi/patches/work-item-kind-v1-compat.yaml`

---

## 1. Objective

Land the new work model safely and incrementally.

That means:

1. Portarium keeps its existing control-plane architecture.
2. Work Items become explicitly typed as `case`, `change`, or `investigation`.
3. Cockpit and the control-plane API both treat `kind` as first-class.
4. `WorkRuntime` becomes the canonical execution-environment term for runtime-backed work.
5. The change lands through small, reviewable PRs rather than one giant architectural blast radius.

---

## 2. Current reality

At the time of writing, the planning/spec branch is materially behind `main`.

Therefore:

- this branch should be treated as a **planning branch**, not a direct merge candidate,
- the landing work should be replayed onto a fresh branch from current `main`,
- the first deliverable should be a clean decision/spec package PR,
- implementation should happen in separate PRs.

---

## 3. Delivery strategy

Use a **two-track** delivery model:

### Track A — decision package

Goal: land architecture, naming, API intent, and rollout plan.

This track contains only:
- specs
- ADRs
- planning docs
- patch files
- lightweight patch-contract tests

### Track B — implementation package(s)

Goal: make the contracts real in code and UI.

This track contains:
- OpenAPI edits
- domain/request validation updates
- persistence/read normalization
- list filtering updates
- Cockpit UI updates
- migration/backfill logic
- runtime lifecycle work later

---

## 4. Branch strategy

## 4.1 Immediate branch hygiene

Create a fresh branch from current `main`, for example:

- `plan/work-item-kind-rollout-v2`

Then replay or cherry-pick the planning artifacts from the current spec branch.

## 4.2 Why

This avoids:
- massive stale-diff review noise,
- accidental merge-base confusion,
- hidden conflicts caused by the current branch being far behind `main`.

## 4.3 Rule

Do not begin control-plane or Cockpit implementation on the stale branch.

---

## 5. PR slicing plan

## PR-1 — Decision package PR

### Goal
Land the decision framework.

### Include
- work-model spec
- proposed bead set
- ADR-0066
- Work Item v2 spec
- control-plane API addendum
- Cockpit/API alignment doc
- OpenAPI patch file
- OpenAPI patch test
- this implementation plan

### Do not include
- edits to the main OpenAPI YAML
- backend validation changes
- Cockpit code changes
- migration scripts

### Acceptance
- naming is settled (`WorkRuntime`)
- Work Item taxonomy is settled (`case`, `change`, `investigation`)
- rollout strategy is explicit
- reviewers can agree on the shape before code lands

---

## PR-2 — Control-plane contract PR

### Goal
Make the API contract real.

### Include
- merge `docs/spec/openapi/patches/work-item-kind-v1-compat.yaml` into `docs/spec/openapi/portarium-control-plane.v1.yaml`
- update `.specify` specs if needed for exact alignment
- extend `src/infrastructure/openapi/openapi-contract.test.ts`
- keep or refine `openapi-work-item-kind-patch.test.ts`

### Required output
- OpenAPI source of truth includes `WorkItemKind`
- list endpoint supports `kind` query param
- Work Item response schema includes `kind`
- create/update contracts match the approved strategy

### Acceptance
- OpenAPI contract passes tests
- no ambiguity remains between patch docs and actual source-of-truth YAML

---

## PR-3 — Backend WorkItem.kind implementation PR

### Goal
Make the backend return and accept the new field correctly.

### Include
- request validation updates
- domain parsing updates
- persistence model updates
- read normalization so every returned Work Item has `kind`
- create behavior for `kind`
- update behavior that rejects `kind` mutation
- list filtering by `kind`

### Compatibility mode
Stage A `/v1` compatibility mode should be used first:
- allow omitted `kind` on create temporarily
- normalize/persist concrete `kind`
- always return concrete `kind`
- mark omission path deprecated in tests/docs

### Acceptance
- every returned Work Item has concrete `kind`
- invalid `kind` is rejected
- PATCH cannot mutate `kind`
- `GET /work-items?kind=change` works

---

## PR-4 — Cockpit adoption PR

### Goal
Make the frontend use `kind` as source of truth.

### Include
- typed client update
- work list badges
- `All / Cases / Changes / Investigations` segmentation
- filters using API-provided `kind`
- detail view switching by `kind`
- create flow defaults and forms

### Acceptance
- Cockpit no longer infers work kind indirectly
- work lists and details are consistent with API payloads
- center panes are selected by `kind`

---

## PR-5 — Historical migration/backfill PR

### Goal
Eliminate missing-kind legacy data.

### Include
- migration logic or read-through normalization hardening
- classification heuristics
- review path for ambiguous items
- migration tests / fixture updates

### Heuristics
- repo / branch / preview / deployment heavy → `change`
- customer / CRM / helpdesk / invoice / email-thread heavy → `case`
- ambiguous / read-heavy / audit-like → `investigation`

### Acceptance
- no client-visible Work Item lacks `kind`
- ambiguous items are traceable and reviewable

---

## PR-6 — WorkRuntime lifecycle PR

### Goal
Begin the actual runtime-backed execution surface.

### Include
- runtime object model in code
- runtime lifecycle/state machine
- browser/terminal child resource models
- local-first supervisor shape
- evidence hooks and policy routing boundaries

### Note
This must happen **after** `kind` is real in the API and UI.

---

## 6. Phase plan

## Phase 0 — Clean landing prep

- create fresh branch from `main`
- replay planning artifacts
- open Decision package PR

## Phase 1 — Contract becomes real

- patch OpenAPI YAML
- patch OpenAPI contract tests
- align `.specify` docs

## Phase 2 — Backend behavior becomes real

- validation
- persistence
- read normalization
- list filtering

## Phase 3 — Cockpit becomes real

- lists
- filters
- detail routing
- create flows

## Phase 4 — Legacy cleanup

- migration/backfill
- ambiguous classification handling

## Phase 5 — Runtime-backed execution

- `WorkRuntime`
- runtime lifecycle
- multi-runtime surfaces later

---

## 7. Rollout policy decision

## Recommended decision

Use **Stage A `/v1` compatibility mode first**.

### Why

- faster path to shipping,
- lower coordination burden,
- allows backend + Cockpit to migrate incrementally,
- avoids blocking on a `/v2` cut too early.

## Stage A rules

- responses always include `kind`
- list supports `kind` filtering
- create accepts `kind`
- create may temporarily tolerate missing `kind`
- omission path is deprecated and tested

## Stage B rules

Later choose one:
- strict `/v1` after all clients are migrated, or
- `/v2` if versioning policy must remain rigidly formal.

---

## 8. Acceptance criteria by layer

## 8.1 Architecture / docs

Accepted when:
- `WorkRuntime` is canonical everywhere new work is added
- no new core docs introduce competing terms
- Work Item taxonomy is consistently explained

## 8.2 OpenAPI / control-plane contract

Accepted when:
- source-of-truth YAML includes `kind`
- list filter exists
- create/update/read contracts match the approved model
- contract tests pass

## 8.3 Backend

Accepted when:
- `kind` is never absent in returned Work Items
- invalid values are rejected
- `kind` cannot be mutated by PATCH
- list filtering works

## 8.4 Cockpit

Accepted when:
- UI uses API-provided `kind`
- badge/filter/detail selection works
- Cases / Changes / Investigations are clearly separated without splitting into separate apps

## 8.5 Migration

Accepted when:
- legacy items are backfilled or normalized
- ambiguous cases are auditable
- no missing-kind records leak to clients

---

## 9. Risks and mitigations

## Risk 1 — versioning ambiguity

### Problem
Required `kind` on create is technically breaking for older clients.

### Mitigation
Use Stage A compatibility mode first.

## Risk 2 — stale planning branch confusion

### Problem
Implementation starts on a stale branch and creates merge pain.

### Mitigation
Restart from current `main` before landing anything substantial.

## Risk 3 — kind drift between backend and UI

### Problem
Cockpit infers kind while backend returns kind, causing mismatch.

### Mitigation
Cockpit must use API `kind` as source of truth.

## Risk 4 — silent reclassification

### Problem
Allowing mutable `kind` creates audit ambiguity.

### Mitigation
Keep `kind` immutable in public PATCH contract.

## Risk 5 — runtime work starts too early

### Problem
Runtime implementation begins before contract and UI semantics are settled.

### Mitigation
Sequence runtime work after the WorkItem.kind rollout is real.

---

## 10. Exact next action

The next exact action is:

**Create a fresh branch from current `main` and land PR-1 (Decision package PR).**

That is the highest-leverage move because it converts all planning done so far into a clean, reviewable, current-base change set.

---

## 11. After PR-1, immediate follow-up

Immediately after PR-1, execute PR-2 and PR-3 in sequence:

1. patch real OpenAPI YAML and tests
2. patch backend validation and persistence

Do not start Cockpit or runtime work before that.

---

## 12. Summary

The rollout should happen in this order:

1. clean branch from `main`
2. Decision package PR
3. Control-plane contract PR
4. Backend WorkItem.kind PR
5. Cockpit adoption PR
6. Migration/backfill PR
7. WorkRuntime lifecycle PR

This keeps the architecture stable, the contract explicit, the UI understandable, and the runtime work sequenced after the semantic model is real.
