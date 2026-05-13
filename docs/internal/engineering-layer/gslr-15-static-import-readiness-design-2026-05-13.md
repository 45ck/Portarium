# GSLR-15 Static Import Readiness Design: 2026-05-13

Status: built import-readiness design gate, no persistent import
Tracking bead: `bead-1258`

## Decision

Portarium now has a test-backed readiness gate for future static GSLR evidence
bundle import. This is not an importer. It is the checklist a future importer
must pass before persistent static evidence records are built.

The gate lives at:

```text
src/domain/evidence/gslr-static-import-readiness-v1.ts
```

It evaluates whether a proposed import plan has crossed the minimum design
boundary for persistent static review.

## Required Gate

A future static import design must satisfy all of these requirements:

- import mode is `persistent-static-review`, not the current manual preview;
- signature trust uses a production keyring, not deterministic test signatures;
- key revocation and rotation are documented;
- trusted algorithms include `ed25519` and exclude `test-ed25519`;
- artifact verification fetches and hashes artifact bytes;
- storage is append-only static record storage;
- raw or source payload bodies are rejected;
- runtime authority remains `none`;
- imported evidence exposes no action controls;
- live engineering endpoints remain blocked;
- operator review state machine is defined;
- required review states exist: received, verified, quarantined,
  review_pending, accepted_static, rejected, and superseded;
- verifier rejections use structured codes instead of UI regex over error
  strings.

If any item is missing, the gate returns `blocked`.

## What It Proves

GSLR-15 proves we now know the next boundary clearly:

- GSLR-13/GSLR-14 manual preview is not enough for persistent import;
- production trust must replace the test-signature verifier;
- artifact refs must become byte-verified evidence, not only declared hash
  coverage;
- imported records need review lifecycle states before operators rely on them;
- rejection categories must become a stable verifier contract before import UI
  or storage depends on them;
- static import design can be evaluated without building runtime ingestion.

This is the right next step because the hard risk has moved from "can Cockpit
show verified evidence?" to "can Portarium store reviewed evidence without
accidentally making it operational?"

## What It Does Not Prove

GSLR-15 does not create or authorize:

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

Passing the readiness gate only authorizes static import design. It does not
authorize implementation of an importer without a separate bead and review.

## Current Readiness Verdict

The current manual preview remains blocked for persistent import because it
still uses:

- manual paste/load preview mode;
- deterministic test signatures;
- declared artifact hash coverage only;
- no append-only imported-record store;
- no persistent operator review state machine;
- rejection labels derived from verifier error messages instead of structured
  codes.

That is acceptable for GSLR-13/GSLR-14. It is not acceptable for import.

## Validation

The implementation was validated with:

```sh
npm run test -- src/domain/evidence/gslr-static-import-readiness-v1.test.ts
```

The tests prove:

- a complete static persistent-review plan passes the design gate;
- the current manual preview shape is blocked from becoming import work;
- any plan with runtime authority, action controls, or live endpoints is
  blocked;
- the full operator review state set is required.

## Next

The next safe step is GSLR-16: structured rejection codes and portable static
fixture corpus.

It should:

- add structured verifier rejection categories/codes;
- replace UI regex mapping over verifier error text;
- materialize adversarial bundles as portable `.bundle.json` fixtures if future
  import tests need file-level corpus evidence;
- continue to avoid persistent import, runtime cards, queues, tables, SSE,
  production actions, and MC connector/data movement.
