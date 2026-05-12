# GSLR-12 Signed Evidence Bundle Proof: 2026-05-13

Status: docs/test-only bundle verifier, no live ingestion
Tracking bead: `bead-1254`

## Decision

Portarium now has a static GSLR evidence-bundle contract and verifier:

```text
src/domain/evidence/gslr-evidence-bundle-v1.ts
```

The verifier accepts `unknown`, parses a strict `GslrEvidenceBundleV1`, checks
bundle provenance, verifies the canonical payload hash and signature through
domain ports, enforces a validity window against an explicit caller-provided
`nowIso`, rejects raw/secret fields, and only then projects the evidence into
the existing `EngineeringEvidenceCardInputV1`.

This is still not live ingestion. It is a manual/static proof that an evidence
bundle can be authenticated before Cockpit displays it.

## Why

GSLR-11 proved operator legibility. It did not prove that Portarium can safely
accept evidence from outside a checked-in fixture.

GSLR-12 answers the next question:

```text
Can Portarium authenticate a GSLR evidence package, reject unsafe payloads, and
convert it to static engineering evidence without granting runtime authority?
```

This is the bridge between static fixtures and any future import path.

## Contract

`GslrEvidenceBundleV1` contains:

- bundle identity and creation time;
- prompt-language provenance: repo, commit, run ID, run group ID;
- task and policy subject;
- the existing GSLR projection evidence payload;
- artifact refs with SHA-256 hashes;
- static-only constraints:
  - `importMode: manual-static-only`;
  - `runtimeAuthority: none`;
  - `actionControls: absent`;
- verification envelope:
  - canonical payload hash;
  - signature;
  - signer key ID and algorithm;
  - validity window.

The canonical payload excludes the verification envelope, so the hash and
signature bind the evidence content, provenance, artifact hashes, and static
constraints.

## What It Proves

- A signed GSLR-8 bundle verifies and projects to a `research-only` static card.
- A signed GSLR-7 bundle verifies but remains `blocked`.
- Tampered payloads fail hash verification.
- Invalid signatures fail verification.
- Raw/secret fields are rejected anywhere in the bundle.
- Provenance cross-link mismatches are rejected.
- Expired bundles are rejected as replay-risk evidence.
- Missing artifact hashes are rejected.
- Runtime-authority claims are rejected before projection.

## What It Does Not Prove

GSLR-12 does not create:

- live prompt-language manifest ingestion;
- persistent evidence-bundle import;
- Cockpit runtime engineering cards;
- route-record queues;
- route-record database tables;
- SSE streams;
- automatic route decisions from GSLR manifests;
- production action execution;
- MacquarieCollege connector observation or raw data movement.

## Validation

Focused validation:

```sh
npm run test -- \
  src/domain/evidence/gslr-evidence-bundle-v1.test.ts \
  src/domain/evidence/gslr-engineering-evidence-card-projection-v1.test.ts \
  src/domain/evidence/engineering-evidence-card-v1.test.ts
```

Result:

```text
Test Files  3 passed (3)
Tests       19 passed (19)
```

Typecheck:

```sh
npm run typecheck
```

Result: passed.

## Conclusion

The next engineering risk has moved from "can we display static evidence?" to
"can we preview externally produced evidence without trusting it?"

GSLR-12 proves the first verifier step. The safe follow-up is GSLR-13: a manual
Cockpit preview/import screen that lets an operator paste or load a bundle,
shows verification status, renders the static card if valid, and still does not
persist anything or create runtime actions.

Follow-up GSLR-12.5 adds checked-in prompt-language bundle fixtures and a
sibling-repo compatibility test. See
`docs/internal/engineering-layer/gslr-12-5-prompt-language-bundle-fixture-handoff-2026-05-13.md`.
