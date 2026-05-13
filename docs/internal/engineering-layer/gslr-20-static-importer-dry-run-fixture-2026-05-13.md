# GSLR-20 Static Importer Dry-Run Fixture: 2026-05-13

Status: implemented as docs/test-only domain dry-run
Tracking bead: `bead-1264`

## Decision

GSLR-20 adds the route-independent dry-run core for the Static Evidence Review
Workbench.

The new domain contract composes the existing static GSLR contracts:

```text
bundle JSON
  -> verifyGslrEvidenceBundleV1
  -> buildVerifiedGslrStaticImportedRecordV1
     or buildRejectedGslrStaticImportedRecordV1
  -> planGslrStaticImportedRecordRepositoryAppendV1
  -> createGslrStaticImportedRecordRepositoryDesignV1().append(...)
  -> dry-run result with repository entries, append audit, blockers, and warnings
```

The implementation lives in:

```text
src/domain/evidence/gslr-static-importer-dry-run-v1.ts
src/domain/evidence/gslr-static-importer-dry-run-v1.test.ts
```

It is intentionally domain-only. It does not add a Cockpit route, persistence,
live ingestion, queues, SSE, route-record tables, runtime cards, action controls,
or MC connector/data access.

## What It Proves

GSLR-20 proves the first workbench acceptance fixture can run end to end in
memory:

- a production-keyring-shaped verified GSLR-8 bundle can produce an accepted
  static imported record, append plan, repository append result, and
  `record_appended` audit event;
- repeating the same dry-run against the same in-memory repository replays
  idempotently instead of duplicating state;
- an invalid-signature GSLR-7 bundle becomes a quarantined static imported
  record with structured rejection code/category and an append-ready failure
  report;
- a test-fixture-signed verified bundle is blocked from accepted import because
  production keyring trust is missing;
- a verified bundle with artifact bytes not fetched is blocked from accepted
  import because artifact byte verification is missing;
- a runtime-authority adversarial bundle is quarantined as rejected static
  evidence and does not gain runtime authority through the repository;
- every dry-run result repeats the boundary that no live prompt-language
  polling, live endpoint calls, queues, SSE streams, runtime Cockpit cards,
  route decisions, production actions, or MC connectors are created.

## Important Interpretation

Verification is not approval.

A static bundle can verify structurally while still being blocked or quarantined
for product use. The dry-run makes that distinction explicit:

- verified GSLR-8 evidence can be accepted only when signer trust is
  production-keyring and artifact bytes are verified;
- prompt-language's checked-in fixtures still use deterministic test
  signatures, so they are valid research fixtures but not production-trusted
  imports;
- rejected or adversarial bundles can be appended only as quarantined static
  evidence with structured failure details.

This preserves the GSLR-15/GSLR-19 boundary: production keyring and artifact byte
verification remain real gates, not wording in a document.

## Workbench Impact

The Static Evidence Review Workbench can now reuse this dry-run contract as its
first route-independent service:

- load or paste a bundle;
- run the verifier;
- show accepted or quarantined imported-record preview;
- show append plan blockers or append result;
- show audit events and idempotency behavior;
- export a static operator report.

The next implementation bead should build the internal Cockpit workbench route
over this dry-run output. That route must still assert no live run, evidence,
work-item, human-task, workforce queue, route-record, SSE, action, importer
runtime, prompt-language polling, or MC connector/source-system calls.

## Boundaries That Remain Blocked

Still blocked after GSLR-20:

- live prompt-language manifest polling;
- artifact byte fetching from live sources;
- production keyring integration;
- production database persistence;
- production imported-record repository implementation;
- runtime Cockpit engineering cards;
- route-record queues or route-record database tables;
- SSE streams for GSLR evidence;
- automatic route decisions from static bundles;
- production actions based on GSLR evidence;
- MC connector observation, source-system reads/writes, or raw school-data
  movement.

## Validation

Focused validation:

```sh
npm run test -- src/domain/evidence/gslr-static-importer-dry-run-v1.test.ts
```

Result: 5 tests passed.

The broader GSLR validation should include:

```sh
npm run test -- src/domain/evidence/gslr-static-importer-dry-run-v1.test.ts src/domain/evidence/gslr-static-imported-record-importer-plan-v1.test.ts src/domain/evidence/gslr-static-imported-record-repository-v1.test.ts src/domain/evidence/gslr-static-imported-record-v1.test.ts src/domain/evidence/gslr-evidence-bundle-v1.test.ts src/domain/evidence/gslr-evidence-bundle-prompt-language-fixtures.test.ts
```

## Next Step

Proceed to `bead-1265`: Static Evidence Review Workbench internal Cockpit route.

That route should render GSLR-20 dry-run results for verified, blocked, and
adversarial cases while proving the route only uses static local data and
bootstrap Cockpit context endpoints.
