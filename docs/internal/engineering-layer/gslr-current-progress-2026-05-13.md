# GSLR Current Progress: 2026-05-13

Status: post-GSLR-28 progress update
Tracking beads: `bead-1253`, `bead-1254`, `bead-1255`, `bead-1256`, `bead-1257`, `bead-1258`, `bead-1259`, `bead-1260`, `bead-1261`, `bead-1262`, `bead-1263`, `bead-1264`, `bead-1265`, `bead-1266`, `bead-1267`, `bead-1268`, `bead-1269`, `bead-1270`, `bead-1271`, `bead-1272`, `bead-1273`, `bead-1274`, `bead-1275`

## Where We Are

We have moved from a routing theory into a small, test-backed engineering
evidence loop:

```text
prompt-language experiment evidence
  -> static Portarium evidence-card contract
  -> frozen Cockpit export model
  -> static Cockpit operator view
  -> signed/static evidence-bundle verification before projection
  -> checked-in prompt-language bundle fixtures verified across the repo boundary
  -> manual Cockpit bundle preview before any runtime import
  -> adversarial static bundle rejection corpus
  -> static import readiness design gate
  -> structured rejection codes and portable adversarial bundle files
  -> static imported-record contract
  -> append-only static imported-record repository contract
  -> manual static imported-record append planner
  -> static importer dry-run fixture
  -> internal Static Evidence Review Workbench route
  -> static operator report export packet
  -> static review-note workflow
  -> production-keyring/artifact-byte verification design split
  -> persistent static imported-record storage design gate
  -> persistent static repository implementation-readiness checklist
  -> persistent static repository stop-review checkpoint
  -> persistent static repository operator/product review packet
  -> persistent static repository port and draft migration contract
  -> persistent static repository adapter contract harness
  -> persistent static repository contract-harness adapter
```

The loop is intentionally static. It proves that evidence can be shaped and
shown honestly before Portarium allows any runtime action.

## What We Have Learned

The useful architecture is mixed:

```text
Codex/frontier models -> planner, advisor, escalation lane, hard-work lane
Prompt Language       -> deterministic scaffolds, gates, policy tables, evidence shape
Local models          -> bounded hook filling inside those scaffolds
Portarium Cockpit     -> operator-visible boundary and governance surface
```

The strongest positive result remains GSLR-8: a PL-owned route-record compiler
passed three local repeats with zero frontier tokens because the local model only
filled small predicate hooks. The strongest negative result remains GSLR-7:
route-record construction failed when the local model still owned policy-table
invariants.

That tells us the system should not ask local models to own governance logic.
It should ask local models to fill narrow, reviewable pieces after Prompt
Language has removed the invariant risk.

## What Is Now Built

Portarium now has:

- a docs/test-only static engineering evidence-card input contract;
- a static GSLR projector for checked-in route evidence;
- a frozen Cockpit-facing export model;
- a static Cockpit route at `/engineering/evidence-cards/static`;
- checked-in static GSLR-8 and GSLR-7 evidence fixtures;
- tests proving the static view renders promoted and blocked evidence without
  action controls;
- a docs/test-only `GslrEvidenceBundleV1` verifier that checks provenance,
  payload hash, signature, validity window, artifact hashes, and static-only
  constraints before projecting evidence to an engineering card;
- a sibling-repo compatibility test that verifies the prompt-language GSLR-8 and
  GSLR-7 static bundle fixtures when that checkout is present;
- an internal manual Cockpit preview at
  `/engineering/evidence-cards/bundle-preview` that loads or accepts pasted
  bundle JSON, verifies it with an explicit `nowIso`, shows the verification
  status, and renders the static evidence card only after verification passes;
- a checked-in adversarial static bundle corpus that covers expired,
  not-yet-valid, payload-hash-tampered, invalid-signature, missing-artifact,
  raw-payload, provenance-mismatch, runtime-authority, and action-controls
  rejection cases through the same preview path;
- a test-backed static import readiness gate that blocks import work unless a
  design defines production keyring trust, artifact byte verification,
  append-only static storage, no runtime authority, no action controls,
  operator review states, and structured verifier rejection codes;
- structured verifier rejection codes/categories for GSLR bundle failures, used
  by the Cockpit preview instead of regex mapping over error messages;
- a portable GSLR-14 adversarial corpus directory with standalone `.bundle.json`
  files and a manifest recording expected rejection code/category for each
  case;
- a docs/test-only `GslrStaticImportedRecordV1` contract for verified and
  rejected static bundles, with source refs, signer trust, artifact
  byte-verification status, operator review state, structured rejection fields,
  timestamps, and fixed no-runtime authority;
- a docs/test-only static imported-record repository contract with append-only
  entries, idempotency keys, duplicate conflict rejection, constrained
  review-state transitions, audit events, and no runtime operation surface;
- a docs/test-only static imported-record importer planner that turns manual
  verified/rejected outcomes into repository append plans only after artifact
  byte policy, production keyring requirement, review defaults, failure
  reporting, and no-runtime authority pass.
- a docs/test-only static importer dry-run contract that composes bundle
  verification, imported-record building, append planning, in-memory repository
  append, idempotent replay, structured quarantine, and no-runtime boundary
  warnings in one route-independent result.
- an internal Cockpit Static Evidence Review Workbench route at
  `/engineering/evidence-cards/workbench` that runs the GSLR-20 dry-run in
  memory and shows accepted, blocked, quarantined, signer-trust,
  artifact-byte-status, append-plan, repository/audit, and static report state
  without making additional live endpoint calls during the dry-run interaction.
- a versioned static operator report packet export from the Workbench that can
  be copied or downloaded for bead/review attachment without creating
  persistence, live endpoints, runtime cards, actions, or MC connector access.
- a static review-note composer that turns an exported report packet into
  copyable bead/review Markdown with constrained operator decision labels.
- a docs/test-only static verification design evaluator that separately reports
  production-keyring readiness and artifact-byte readiness while blocking live
  source fetches, runtime authority, actions, live endpoints, and MC connector
  access.
- a docs/test-only persistent static storage design evaluator gated by
  verification readiness, requiring append-only, idempotent, fingerprinted, and
  audited storage while blocking mutable storage and runtime surfaces.
- a docs/test-only persistent static repository implementation-readiness
  checklist that blocks already-applied migrations/tables/writes and requires
  contract, migration, audit, backup, retention, observability, and security
  plans before a future implementation bead can open.
- a docs/test-only stop-review checkpoint that pauses real persistent storage
  implementation until operator and product review complete a static-only
  decision.
- a docs/test-only operator/product review packet that can open a narrow
  implementation bead only after the static report, review note, operator
  approval, product approval, static value confirmation, and no-runtime
  safeguards are present.
- a docs/test-only persistent static repository implementation contract that
  defines the port surface and unapplied draft migration while keeping
  production tables, production writes, live ingestion, runtime cards, actions,
  and MC connector access blocked.
- a docs/test-only persistent static repository adapter contract harness that
  defines required adapter assertions while keeping migrations unapplied and
  production writes disabled.
- a docs/test-only persistent static repository contract-harness adapter that
  satisfies the adapter assertions while exposing no update/delete/runtime
  operations and keeping migrations, tables, and writes disabled.

prompt-language now records GSLR-8 as the strongest local-screen result and
publishes checked-in static bundle fixtures for GSLR-8 and GSLR-7.

MacquarieCollege now records the same boundary: MC remains a reference vertical
only, with no connector observation, source-system reads or writes, raw payload
movement, runtime cards, or production action paths.

## What This Proves

GSLR-11 proves static operator legibility:

- positive local-screen evidence can be displayed without becoming operational;
- failed evidence can be displayed as `blocked` instead of disappearing;
- route, model, gates, cost, artifacts, and boundary warnings can fit a Cockpit
  operator surface;
- Cockpit can show the mixed frontier/PL/local-model decision boundary without
  live ingestion.

GSLR-12 proves static verifier legibility:

- externally shaped GSLR evidence can be authenticated before projection;
- tampering, invalid signatures, expired bundles, missing artifact hashes, raw
  payload fields, provenance mismatches, and runtime-authority claims are
  rejected;
- verified failed evidence still projects as `blocked`.

GSLR-12.5 proves the handoff shape:

- prompt-language can produce static bundles that satisfy Portarium's verifier;
- artifact refs can be hash-checked against prompt-language files;
- verifier calls must pass an explicit `nowIso`;
- the cross-repo boundary remains manual/static only.

GSLR-13 proves static manual preview legibility:

- Cockpit can expose bundle verification as an operator-visible manual check;
- GSLR-8 positive evidence and GSLR-7 blocked evidence can both pass through the
  same bundle preview without creating runtime authority;
- tampered or malformed bundles become rejected evidence, not runtime errors;
- the route does not request live run, evidence, work-item, human-task, or
  workforce queue endpoints.

GSLR-14 proves static rejection legibility:

- every adversarial bundle case is rejected;
- rejected bundles do not render static evidence cards;
- rejected cases identify the failed check row instead of collapsing into an
  opaque runtime error;
- the route still avoids live engineering endpoints while exercising the
  rejection path.

GSLR-15 proves static import readiness can be judged before import exists:

- the current manual preview shape is explicitly blocked from persistent import;
- a future static import design must replace test signatures with production
  keyring trust;
- a future design must verify artifact bytes instead of only declared refs;
- imported evidence needs append-only static storage and operator review states;
- structured rejection codes are required before import UI or storage depends on
  verifier failures;
- any plan with runtime authority, action controls, or live endpoints remains
  blocked.

GSLR-16 proves structured rejection portability:

- GSLR bundle verifier failures now expose stable `code` and `category` fields;
- Cockpit preview rejection rows use verifier categories instead of regex over
  error text;
- every adversarial corpus case exists as a standalone `.bundle.json` file;
- every portable adversarial file rejects with the expected code/category;
- the route still avoids live engineering endpoints while exercising rejection.

GSLR-17 proves static imported-record shape:

- verified bundles can become accepted static records;
- rejected bundles can become quarantined records with structured rejection
  code/category;
- signer key identity and test-fixture trust can be represented without
  claiming production trust;
- artifact byte-verification status has an explicit field;
- runtime authority or action-control claims are rejected by the record builder.

GSLR-18 proves static repository behavior:

- accepted records append and replay idempotently;
- conflicting idempotency-key or record-id duplicates are rejected instead of
  overwritten;
- quarantined records can move through constrained review-state transitions;
- review transitions create new revisions and audit events;
- imported records that claim live authority are rejected;
- the repository contract has no update, delete, queue, stream, subscribe, or
  execute operation.

GSLR-19 proves static importer planning:

- verified outcomes can become accepted append plans when production trust and
  artifact byte verification are present;
- rejected outcomes can become quarantined append plans with structured failure
  reports;
- readiness blockers prevent append input creation;
- live polling, production database targets, runtime authority, action
  controls, and live endpoints block planning;
- records that claim live authority are rejected by the planner.

GSLR-20 proves static importer dry-run composition:

- verified production-trusted GSLR-8-shaped evidence can become an accepted
  static append result in an in-memory repository;
- repeated dry-runs replay idempotently instead of duplicating repository state;
- invalid-signature GSLR-7-shaped evidence becomes quarantined static evidence
  with structured rejection code/category and failure report;
- test-signature verified fixtures and artifact bytes that are not fetched remain blocked
  from accepted import;
- runtime-authority adversarial bundles are quarantined and cannot gain runtime
  authority through the repository.

`bead-1265` proves static operator review:

- the GSLR-20 dry-run result is visible in Cockpit;
- accepted, blocked, and quarantined cases are legible to an operator;
- signer trust, artifact byte status, structured rejection, append blockers,
  repository dry-run state, and audit event are visible;
- the workbench interaction makes no live run, evidence, work-item, human-task,
  workforce, route-record, SSE, action, prompt-language polling, importer,
  connector, Macquarie, or school endpoint calls.

`bead-1266` proves static operator handoff:

- the Workbench report is now a versioned JSON packet;
- the packet carries route, dry-run status, source ref, record/review state,
  signer trust, artifact byte status, structured rejection, append blockers,
  repository/audit state, boundary warnings, and the human-readable report text;
- the packet can be copied or downloaded through browser-local APIs;
- the export interaction makes no live endpoint calls.

`bead-1267` proves static decision capture:

- report packets can be attached to bead/review notes as Markdown;
- operator decision labels are constrained to
  `attach_static_report_only`, `accept_static_evidence_no_runtime`,
  `block_static_import`, and `quarantine_static_rejected`;
- the generated note carries bead/review ref, reviewer, decision, report link,
  evidence summary, rationale, and static-only boundary warning;
- copying the note uses browser-local clipboard APIs and makes no live endpoint
  calls.

`bead-1268` proves static verification design readiness:

- production-keyring readiness and artifact-byte readiness are evaluated
  separately;
- the recommended design requires pinned production keyring trust, `ed25519`
  only, documented revocation/rotation, operator-supplied artifact bytes,
  SHA-256 hashing, missing-byte blocking, mismatch quarantine, and raw-payload
  rejection;
- test fixtures, network-discovered keyrings, declared-hash-only artifacts,
  live-source artifact fetches, runtime authority, actions, live endpoints, and
  MC connector access are blocked.

`bead-1269` proves persistent static storage design readiness:

- persistent storage design is gated by static verification readiness;
- the recommended design requires append-only storage, required idempotency,
  canonical JSON SHA-256 fingerprints, conflict rejection with identical replay,
  append-only audit events, constrained review transitions, actor/reason
  requirements, deletion prohibition, export permission, and raw-payload storage
  rejection;
- mutable/upsert/overwrite/last-write-only storage, free-form review, deletion,
  raw payload storage, queues, SSE streams, live endpoints, runtime authority,
  actions, and MC connector access are blocked.

`bead-1270` proves implementation readiness can be checked before implementation:

- a future implementation bead is gated by the persistent static storage design;
- already-applied migrations, production tables, or production writes block the
  checklist;
- repository port, append-only schema, idempotency constraint, fingerprint
  constraint, audit-event schema, review transition table, migration draft,
  backup/restore plan, static-only observability, delete-prohibited retention,
  verification-gate dependency, raw payload prohibition, no runtime authority,
  and blocked MC connector access are required;
- the checklist outputs the implementation artifacts the future bead must
  produce.

This is enough to continue toward a governed engineering cockpit. It is not
enough to create runtime automation.

## What Remains Blocked

Still blocked:

- live prompt-language manifest ingestion;
- signed-bundle import into production state;
- production keyring implementation;
- live artifact byte fetching from source systems;
- artifact byte storage;
- production static imported-record repository implementation;
- production database migrations for imported records;
- static imported-record importer implementation;
- persistent storage of static operator reports;
- runtime Cockpit engineering cards;
- route-record queues;
- route-record database tables;
- SSE streams for GSLR evidence;
- automatic route decisions from GSLR manifests;
- production actions based on GSLR evidence;
- MC connector observation or raw school-data movement.
- persistent signed-bundle import until a separate implementation bead satisfies
  the GSLR-15 readiness gate.

## Next Step

The latest safe work item is a stop-and-review checkpoint before real persistent
storage implementation. GSLR-20 supplied the route-independent dry-run core,
`bead-1265` supplied the internal Workbench route, `bead-1266` supplied the
portable operator report packet, `bead-1267` supplied constrained static
review-note capture, `bead-1268` supplied the production-keyring/artifact byte
verification design gate, `bead-1269` supplied the persistent static storage
design gate, `bead-1270` supplied the implementation-readiness checklist, and
`bead-1271` supplied the stop-review checkpoint, `bead-1272` supplied the
operator/product static-only review packet, `bead-1273` supplied the persistent
static repository port plus draft migration contract, `bead-1274` supplied the
adapter contract harness, and `bead-1275` supplied the contract-harness adapter.

See
[`static-evidence-review-workbench-plan-2026-05-13.md`](./static-evidence-review-workbench-plan-2026-05-13.md).

Proceed to `bead-1276`: review checkpoint before any database adapter. It should
decide whether the contract-harness adapter is sufficient for now or whether to
build a draft Postgres adapter behind the same contract with migrations still
unapplied. It must not add live polling, production writes, runtime cards,
production actions, or MC connector/source-system access.

Production keyring, artifact byte fetching, persistent storage, live routing,
runtime cards, and MC connector work remain separate gated follow-ups.
