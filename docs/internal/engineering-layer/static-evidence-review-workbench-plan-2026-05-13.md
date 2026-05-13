# Static Evidence Review Workbench Plan: 2026-05-13

Status: engineering plan after post-GSLR-19 agent review
Tracking bead: `bead-1263`

## Decision

Stop broad GSLR research for the core architecture and begin a narrow
engineering milestone: the Static Evidence Review Workbench.

This does not unlock live automation. The first product slice remains manual,
static, and operator-reviewed:

```text
checked-in or pasted GSLR bundle
  -> static verifier
  -> imported-record builder
  -> importer planner
  -> dry-run append/review/audit view
  -> operator report
```

The workbench is the bridge between the research evidence loop and a usable
engineering cockpit. It should turn GSLR-20 into the acceptance fixture for the
first product slice, not into another open-ended research step.

## Why This Is the Right Next Step

The current evidence is strong enough to build a safe product surface:

- GSLR-8 proves local models can work when Prompt Language owns the policy
  tables, route envelope, escalation order, artifact-ref rules, and static
  output shape while the local model fills narrow predicate hooks.
- GSLR-7 rejects the broader version where a local model owns route-record
  policy invariants.
- GSLR-5R, GSLR-3, and GSLR-4 reject broad local ownership of privacy-sensitive
  transforms, evidence-card assembly, and multi-file validation decisions.
- GSLR-9 through GSLR-19 prove a static evidence path inside Portarium:
  projection, Cockpit export, manual preview, signed/static bundle verification,
  adversarial rejection, readiness gates, imported records, repository
  contracts, and manual append planning.

The learning is not "local models replace frontier models." The learning is:

```text
Codex/frontier models -> planning, advising, diagnosis, hard or ambiguous work
Prompt Language       -> deterministic scaffolds, gates, policy, evidence shape
Local models          -> bounded hook filling after invariant risk is removed
Portarium Cockpit     -> operator-visible review, governance, and audit surface
```

That architecture is now clear enough to engineer a static review cockpit. More
general research should wait until product engineering exposes a specific
unknown.

## Product Boundary

The workbench may do these things:

- load checked-in static bundle fixtures;
- accept pasted static bundle JSON;
- verify payload hash, signature, validity window, provenance, artifact refs,
  and static-only constraints;
- show structured rejection code and category;
- build accepted or quarantined static imported-record views;
- run manual importer planning;
- run dry-run append behavior against the in-memory repository contract;
- show idempotency, review state, and audit events;
- export an operator report.

The workbench must not do these things:

- poll prompt-language manifests;
- fetch live prompt-language runs;
- fetch artifacts from ungoverned sources;
- write production database state;
- create runtime Cockpit cards;
- create route-record queues or database tables;
- open SSE streams;
- make automatic route decisions;
- expose action controls;
- execute production actions;
- observe MC connectors;
- read, write, move, or display raw school data.

## MVP

The minimum useful workbench has one internal Cockpit surface:

```text
/engineering/evidence-cards/workbench
```

The route should support:

- fixture selection for the known GSLR-8 accepted and GSLR-7 blocked bundles;
- paste area for static bundle JSON;
- explicit `nowIso` verification clock;
- verifier result panel with structured success or rejection details;
- static imported-record preview;
- accepted/quarantined status;
- review-state preview;
- dry-run repository append and audit trail;
- operator report export;
- persistent boundary copy that says the workbench is static review only and has
  no runtime authority.

It should reuse the existing verifier, imported-record builder, repository
contract, and importer planner instead of inventing new product semantics.

## GSLR-20 Acceptance Fixture

GSLR-20 becomes the acceptance fixture for this milestone.

It should prove:

- a checked-in verified GSLR-8 bundle verifies;
- a checked-in rejected or blocked GSLR-7 bundle verifies or reports its blocked
  route truthfully;
- adversarial bundles still reject with stable code/category values;
- verified outcomes produce accepted append plans only when trust and artifact
  byte policy requirements are represented;
- rejected outcomes produce quarantined append plans with structured failure
  reports;
- dry-run repository append behavior is append-only and idempotent;
- conflicting idempotency keys or record IDs reject;
- review-state transitions are constrained and audited;
- the route does not call live run, evidence, work-item, human-task, workforce
  queue, route-record, SSE, action, or MC connector endpoints.

Passing GSLR-20 means the first static product loop is real enough for internal
operator review. It does not mean production import or runtime automation is
approved.

## Milestones

### Milestone 1: Static Dry-Run Core

Status: complete in GSLR-20.

Build the GSLR-20 test fixture and route-independent service shape.

Acceptance:

- verifier, imported-record builder, importer planner, and repository contract
  run together in one dry-run path;
- accepted and quarantined fixtures both produce operator-readable plans;
- failures are structured, not regex-derived;
- no persistent writes or live endpoints are introduced.

### Milestone 2: Cockpit Workbench Route

Status: complete in `bead-1265`.

Build the internal route and operator view.

Acceptance:

- fixture picker and pasted JSON flow work;
- verification status, imported-record preview, append plan, review state, and
  audit trail are visible;
- blocked/rejected evidence remains visible without becoming operational;
- route tests prove no live/runtime/action endpoints are called.

### Milestone 3: Operator Report

Status: next.

Add a static export/report packet.

Acceptance:

- report includes bundle identity, signer trust status, artifact refs, artifact
  byte status, accepted/quarantined status, review state, audit events, and
  boundary warnings;
- report can be attached to a bead or review note;
- report does not include raw payloads or hidden oracle content.

### Milestone 4: Production-Readiness Design Split

Only after the workbench is useful, split future production work into separate
beads.

Candidate follow-ups:

- production keyring and signature trust;
- artifact byte fetch and hash verification;
- persistent append-only static imported-record storage;
- authz and tenancy for imported static evidence;
- operator review workflow over persisted imported records.

Each follow-up needs its own gate and must keep live routing, actions, and MC
data out of scope until separately approved.

## Stop-Research Gate

Stop research and continue engineering when all of these are true:

- the GSLR-20 dry-run fixture passes for accepted, blocked, and adversarial
  cases;
- the workbench shows the same result an operator would need to review;
- structured failures and audit events are visible;
- no hidden runtime authority exists in the route or domain contracts;
- MC remains docs/static/reference only.

Restart research only for a specific unanswered question, such as:

- a local-model route that needs N=3 repeat evidence;
- production keyring or artifact-byte verification uncertainty;
- a storage/audit design issue;
- an MC live-read gate question.

Do not restart broad literature review simply because the system is still
unfinished. The next useful learning now comes from building the static
workbench.

## MC Boundary

MacquarieCollege remains a reference vertical only during this milestone.

Allowed MC participation:

- sanitized terminology;
- architecture documents;
- static redacted examples;
- opaque source refs;
- boundary tests for governance language.

Blocked MC participation:

- source-system reads or writes;
- connector observation;
- raw student, staff, ticket, device, room, connector, credential, token, or
  session payloads;
- browser extension calls to source systems;
- runtime Cockpit cards;
- queues, SSE, production importer runtime, or action paths.

Before any MC connector/data engineering, the MC read-only gates must be met:

- one canonical capability registry;
- parity tests across pack, guards, policy, allow-lists, and evidence;
- read-only credentials or explicit allow-list;
- kill switch;
- minimized DTOs;
- restricted-read audit events;
- proof that raw source payloads do not cross the boundary;
- human approval before live connector observation;
- a new ADR before any mutation-capable workflow.

## Symphony And Agent-Orchestration Implication

OpenAI Symphony validates the direction of using tickets as an agent control
plane, but Portarium's near-term implementation should stay smaller:

```text
bead/task
  -> bounded agent or local-model work
  -> static evidence bundle
  -> Portarium workbench review
  -> human decision
```

The workbench is not a Symphony clone. It is the governance surface that can
later make Symphony-style agent work reviewable, auditable, and safe.

## Risks

- Research drift: continuing GSLR micro-steps could polish boundaries without
  improving product learning.
- UI authority confusion: an operator screen may imply operational authority
  unless every view repeats the static/no-runtime boundary.
- Trust confusion: static evidence trust is not production trust until keyring
  and artifact byte verification are implemented.
- MC scope creep: MC docs can inform vocabulary, but cannot become live data
  input during this milestone.
- Premature persistence: production database work is not justified until the
  dry-run workbench proves the operator loop is useful.

## Validation

Minimum validation before close:

```sh
npm run test -- gslr
npm run typecheck
npm run lint
npm run format:check
npm run spell
```

If the Cockpit route changes are material, also run the focused Cockpit test
suite and build.

The route-level tests must assert absence of live/runtime/action calls, not only
that the happy path renders.

## Bead Sequence

Recommended next beads:

- `bead-1264`: GSLR-20 static importer dry-run acceptance fixture.
- `bead-1265`: Static Evidence Review Workbench internal Cockpit route.
- `bead-1266`: Workbench operator report export.
- `bead-1267`: Static evidence review-note workflow.
- `bead-1268`: Production keyring and artifact-byte verification design split.
- `bead-1269`: Persistent static imported-record storage design, blocked by
  `bead-1268`.
- `bead-1270`: Persistent static repository implementation-readiness checklist,
  blocked by `bead-1269`.
- `bead-1271`: Stop-and-review checkpoint before real persistent storage
  implementation.
- `bead-1272`: Operator/product static-only review packet before opening real
  persistent storage implementation.

Do not create beads for live PL polling, runtime cards, route-record queues,
production actions, or MC connector/data engineering from this plan.
