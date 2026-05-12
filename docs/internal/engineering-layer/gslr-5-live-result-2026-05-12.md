# GSLR-5 Live Result: 2026-05-12

Status: R&D live result, not runtime ingestion  
Tracking bead: `bead-1241`  
Companion prompt-language bead: `prompt-language-gslr16`

## Decision

Prompt-language ran the GSLR-5 raw-payload adversarial static sanitizer live.

Result:

- `frontier-only` passed with 53,668 frontier tokens;
- `local-only` diagnostic failed before hidden adversarial traps by rejecting
  safe relative artifact refs on the safe card;
- route remains `frontier-baseline`.

## Portarium Meaning

This is useful Portarium evidence because it tests the boundary closest to real
Cockpit risk: raw payloads, school/person-data strings, secret fields, and
unsafe artifact refs must not become evidence-card content.

What the result supports:

- a static sanitizer boundary is necessary before any live evidence-card
  product surface;
- privacy-sensitive card shaping should default to `frontier-baseline`;
- local-only is not ready for this task shape under the current lane prompt;
- valid safe refs and blocked cards must stay first-class, because false
  rejection also breaks evidence flow.

What it does not support:

- live Cockpit cards from prompt-language manifests;
- a service, queue, database table, or ingestion path for GSLR manifests;
- local or advisor routing as a default for privacy-sensitive evidence cards;
- MC connector observation or school-data movement.

## Next Product Boundary

Do not build runtime ingestion yet.

The next useful work is still R&D: repair the local lane prompt/design and test
whether it can preserve safe relative refs while rejecting raw payload traps.

Portarium product work should stay limited to docs/test-only static contract
hardening until that route evidence improves.

## Sources

- Prompt-language GSLR-5 live result:
  `experiments/harness-arena/results/gslr5-live-2026-05-12/report.md`
- Prompt-language post-GSLR-5 decision:
  `docs/evaluation/2026-05-12-post-gslr5-research-decision.md`
- Prompt-language route policy:
  `experiments/harness-arena/gslr-policy-schema-routing-policy.v1.json`

## Execution Record

2026-05-12:

- Recorded the GSLR-5 live result.
- Kept runtime ingestion and live Cockpit cards blocked.
- Recorded privacy-sensitive evidence-card sanitization as a frontier-baseline
  route under current lanes.
