# GSLR-16 Structured Rejection Codes And Portable Corpus: 2026-05-13

Status: built structured rejection codes and portable static corpus, no import
Tracking bead: `bead-1259`

## Decision

Portarium now has stable structured rejection codes for GSLR evidence bundle
verification errors. The Cockpit manual preview maps rejected check rows from
the verifier error category instead of matching verifier message text with UI
regexes.

The adversarial corpus is also materialized as standalone `.bundle.json` files:

```text
apps/cockpit/src/components/cockpit/gslr-14-adversarial-corpus/
```

Those files are still static/manual/test fixtures. They are not imported into
state and they do not create runtime authority.

## Structured Rejection Contract

The verifier now exposes:

```ts
error.code;
error.category;
```

The current categories are:

- `payload_hash`
- `signature`
- `provenance`
- `validity_window`
- `artifact_hash_coverage`
- `static_constraints`

The current codes are:

- `payload_hash_mismatch`
- `signature_invalid`
- `provenance_mismatch`
- `validity_window_invalid`
- `artifact_hash_missing`
- `artifact_ref_invalid`
- `raw_payload_forbidden`
- `schema_invalid`
- `static_constraint_violation`

Cockpit check rows now use the category, not the error text, to decide which
boundary rejected a bundle.

## Portable Corpus

GSLR-14 originally generated adversarial JSON strings from TypeScript fixture
metadata. GSLR-16 keeps that metadata source but also writes portable files:

- `expired-window.bundle.json`
- `not-yet-valid-window.bundle.json`
- `payload-hash-tamper.bundle.json`
- `invalid-signature.bundle.json`
- `missing-artifact-hash.bundle.json`
- `raw-payload-key.bundle.json`
- `provenance-mismatch.bundle.json`
- `runtime-authority-claim.bundle.json`
- `action-controls-claim.bundle.json`
- `manifest.json`

The manifest records the expected check label, rejection code, and rejection
category for each case.

## What It Proves

GSLR-16 proves:

- rejection reasons are now stable machine-readable contract data;
- the preview no longer depends on regex mapping over verifier message text;
- every adversarial corpus file matches the generated fixture metadata;
- every portable adversarial file rejects with the expected structured code;
- the preview route still rejects adversarial bundles without live engineering
  endpoint calls.

This removes a real import-readiness risk from GSLR-15. A future importer can
record structured rejection outcomes without scraping UI text or exception
messages.

## What It Does Not Prove

GSLR-16 does not create or authorize:

- persistent signed-bundle import;
- live prompt-language manifest ingestion;
- runtime Cockpit engineering cards;
- route-record queues;
- route-record database tables;
- SSE streams;
- automatic route decisions from GSLR manifests;
- production actions based on GSLR evidence;
- MacquarieCollege connector observation, source-system reads or writes, or raw
  school-data movement.

## Validation

The implementation was validated with:

```sh
npm run -w apps/cockpit test -- src/components/cockpit/gslr-manual-bundle-adversarial-fixtures.test.ts src/components/cockpit/gslr-manual-bundle-preview.test.tsx src/routes/engineering/gslr-bundle-preview-route.test.tsx
npm run test -- src/domain/evidence/gslr-evidence-bundle-v1.test.ts
```

The focused tests prove:

- verifier errors expose expected codes and categories;
- portable corpus files match fixture metadata;
- portable corpus files reject with expected structured codes;
- manual preview check rows still target the right boundary;
- route-level rejection behavior still avoids live engineering endpoints.

## Next

The next safe step is GSLR-17: persistent static imported-record design.

It should define the stored record shape for a verified or rejected static
bundle, including keyring identity, artifact-byte verification status, review
state, rejection code/category, and boundary warnings. It should still be a
design/test step only. Do not build live PL ingestion, runtime cards, queues,
tables, SSE, production actions, or MC connector/data movement from GSLR-16.
