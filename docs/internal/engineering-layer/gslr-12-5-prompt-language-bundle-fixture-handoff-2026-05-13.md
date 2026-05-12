# GSLR-12.5 Prompt-Language Bundle Fixture Handoff: 2026-05-13

Status: sibling-repo fixture compatibility, no live ingestion
Tracking bead: `bead-1255`

## Decision

prompt-language now publishes checked-in static `GslrEvidenceBundleV1` fixtures
for the two route-record boundary cases:

- GSLR-8 `gslr8-route-record-compiler`: verified positive `local-screen`
  evidence from the PL-owned route-record compiler shape.
- GSLR-7 `gslr7-scaffolded-route-record`: verified negative
  `frontier-baseline` evidence from the broader scaffolded route-record shape.

Portarium now has a sibling-repo compatibility test that reads those fixtures,
checks their artifact hashes against the prompt-language files, verifies them
through `verifyGslrEvidenceBundleV1`, and confirms that GSLR-8 projects to a
`research-only` card while GSLR-7 remains `blocked`.

The test skips only when the prompt-language sibling checkout is not present,
so Portarium remains cloneable and testable by itself.

## Contract Tightening

`verifyGslrEvidenceBundleV1` now requires callers to pass an explicit `nowIso`.
Manual preview code must choose the verification clock deliberately instead of
falling back to bundle creation time.

This matters because bundle validity is part of the evidence boundary. The
manual Cockpit preview should fail expired or not-yet-valid bundles under the
operator-visible verification time.

## What It Proves

- prompt-language can produce checked-in static bundles that match Portarium's
  verifier contract.
- The GSLR-8 positive and GSLR-7 negative evidence can cross the repo boundary
  without changing the safety boundary.
- Static artifact refs are repository-relative and hash-checked in the fixture
  test.
- Portarium can verify the fixtures with the same payload-hash and test-signature
  logic used by the bundle verifier tests.

## What It Does Not Prove

This handoff does not create:

- live prompt-language ingestion;
- persistent bundle import;
- runtime Cockpit engineering cards;
- route-record queues or database tables;
- SSE streams;
- automatic route decisions;
- production action execution;
- MacquarieCollege connector observation or raw data movement.

## Next

GSLR-13 is now ready to start as a manual Cockpit bundle preview. It should load
one of the checked-in prompt-language fixtures, run the verifier with an
explicit `nowIso`, show verification status, and render a static evidence card
only after successful verification.
