# GSLR-13 Manual Cockpit Bundle Preview: 2026-05-13

Status: built static/manual preview, no live ingestion
Tracking bead: `bead-1256`

## Decision

Portarium Cockpit now has an internal manual preview route for static GSLR
evidence bundles:

```text
/engineering/evidence-cards/bundle-preview
```

The preview can load the checked-in GSLR-8 and GSLR-7 prompt-language bundle
fixtures or accept pasted `GslrEvidenceBundleV1` JSON. It verifies the bundle in
memory with `verifyGslrEvidenceBundleV1` and an explicit verification clock:

```text
2026-05-13T02:00:00.000Z
```

Only a verified bundle projects into the existing static engineering evidence
card. Rejected JSON or rejected bundle verification becomes visible rejection
evidence in the preview instead of a runtime card or app error.

## What Is Built

- fixture buttons for GSLR-8 `gslr8-route-record-compiler` and GSLR-7
  `gslr7-scaffolded-route-record`;
- pasted JSON input for manual bundle checks;
- operator-editable `nowIso` verification time;
- explicit check rows for JSON parse, payload hash, signature, provenance,
  validity window, artifact hash coverage, and static constraints;
- projection to the static Cockpit evidence-card view only after verification
  passes;
- rejected-state display for malformed JSON, tampering, invalid signatures,
  provenance/window failures, missing artifact hashes, or non-static authority
  claims;
- navigation under the internal engineering section as `GSLR Preview`.

## What It Proves

GSLR-13 proves the static handoff can be made operator-legible:

- prompt-language bundle fixtures can be pasted or loaded in Cockpit;
- Cockpit can run the same verifier used by Portarium tests before showing the
  evidence card;
- GSLR-8 appears as positive `research-only` local-screen evidence only after
  verification passes;
- GSLR-7 appears as blocked evidence, preserving negative evidence instead of
  hiding it;
- rejected bundles are explainable at the boundary before any persistence or
  runtime action exists.

This is an important step because it connects the research contract to the
operator surface while keeping the operational boundary intact.

## What It Does Not Prove

GSLR-13 does not create or authorize:

- live prompt-language manifest ingestion;
- persistent bundle import;
- runtime Cockpit engineering cards;
- route-record queues;
- route-record database tables;
- SSE streams;
- automatic route decisions from GSLR manifests;
- production actions based on GSLR evidence;
- MacquarieCollege connector observation, source-system reads or writes, or raw
  school-data movement.

The signatures are deterministic test signatures for static fixtures. They prove
shape, verifier wiring, and UI boundary behavior, not production trust.

## Validation

The implementation was validated with:

```sh
npm run -w apps/cockpit test -- src/components/cockpit/gslr-manual-bundle-preview.test.tsx src/routes/engineering/gslr-bundle-preview-route.test.tsx src/routes/engineering/static-evidence-cards.test.tsx src/components/cockpit/gslr-static-evidence-card-view.test.tsx
npm run -w apps/cockpit build
```

The focused tests cover:

- SHA-256 compatibility for the browser-side preview hasher;
- verified GSLR-8 and GSLR-7 fixture loading;
- tamper rejection against the payload hash;
- rendering the evidence card only after the operator clicks verify;
- route rendering without requesting live run, evidence, work-item,
  human-task, or workforce queue endpoints.

## Next

The next safe step is GSLR-14: an adversarial static bundle corpus and review
checklist.

It should add checked-in rejected examples for expired bundles, not-yet-valid
bundles, payload-hash tampering, invalid signatures, missing artifact hashes,
raw payload keys, provenance mismatches, and runtime-authority claims. That gives
the preview a clearer red-team corpus before any import workflow is considered.
