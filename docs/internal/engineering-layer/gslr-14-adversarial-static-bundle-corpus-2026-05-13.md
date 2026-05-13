# GSLR-14 Adversarial Static Bundle Corpus: 2026-05-13

Status: built static/manual rejection corpus, no live ingestion
Tracking bead: `bead-1257`

## Decision

Portarium now has a checked-in adversarial static bundle corpus for the GSLR-13
manual Cockpit preview. The corpus is loaded by the same preview route:

```text
/engineering/evidence-cards/bundle-preview
```

The adversarial cases are deterministic static JSON fixtures derived from the
known-good GSLR-8 bundle shape. They exercise the same in-memory
`verifyGslrEvidenceBundleV1` path used by the manual preview.

## Corpus

The GSLR-14 corpus covers:

- expired validity window;
- not-yet-valid window;
- payload hash tampering;
- invalid signature;
- missing artifact hash;
- raw payload key;
- provenance mismatch;
- runtime-authority claim;
- action-controls-present claim.

Each rejected case has an expected failed check label so the preview can show
which boundary rejected the bundle: payload hash, signature, provenance,
validity window, artifact hash coverage, or static constraints.

## What It Proves

GSLR-14 proves the manual preview is not only a happy-path display:

- every adversarial static fixture is rejected;
- rejected bundles do not project into static evidence cards;
- the preview shows a targeted rejected check row instead of only a generic
  runtime error;
- the route still makes no live run, evidence, work-item, human-task, or
  workforce queue requests;
- the rejection path remains in-memory/manual/static.

This is the right proof before import design because a governed engineering
surface must refuse unclear authority as reliably as it displays valid evidence.

## What It Does Not Prove

GSLR-14 does not create or authorize:

- live prompt-language manifest ingestion;
- persistent bundle import;
- runtime Cockpit engineering cards;
- route-record queues;
- route-record database tables;
- SSE streams;
- automatic route decisions from GSLR manifests;
- production action execution;
- production keyring/signature trust;
- artifact byte fetching or artifact-content hashing in the browser preview;
- MacquarieCollege connector observation, source-system reads or writes, or raw
  school-data movement.

The corpus uses deterministic static fixtures and the existing test-signature
verifier. It proves rejection behavior and operator legibility, not production
trust.

## Validation

The implementation was validated with:

```sh
npm run -w apps/cockpit test -- src/components/cockpit/gslr-manual-bundle-preview.test.tsx src/routes/engineering/gslr-bundle-preview-route.test.tsx src/routes/engineering/static-evidence-cards.test.tsx src/components/cockpit/gslr-static-evidence-card-view.test.tsx
npm run typecheck
npm run -w apps/cockpit build
```

The focused tests cover:

- all GSLR-13 happy-path fixture behavior;
- every GSLR-14 adversarial fixture rejecting with a targeted check row;
- rejected adversarial fixtures not rendering a static card;
- route-level rejection behavior for every adversarial case without live
  engineering endpoint calls.

## Next

The next safe step is GSLR-15: static import readiness design.

It should be a design/test-gate step, not live import. It should specify the
production trust boundary, keyring/signature requirements, artifact byte
verification model, storage/no-runtime boundary, and operator review state
machine needed before any persistent import workflow is considered.
