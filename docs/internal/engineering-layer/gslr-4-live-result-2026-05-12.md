# GSLR-4 Live Result: 2026-05-12

Status: R&D live result, not runtime ingestion  
Tracking bead: `bead-1240`  
Companion prompt-language bead: `prompt-language-gslr15`

## Decision

Prompt-language ran the GSLR-4 two-file static evidence-card validator live.

Result:

- `advisor-only` passed, but used 32,862 frontier tokens;
- `frontier-only` passed with 20,579 frontier tokens;
- `local-only` failed the private oracle by throwing on `null`.

The route for `gslr4-two-file-validator` is therefore `frontier-baseline` under
the current lanes. Advisor-only is a useful diagnostic signal, not a
cost-effective selected route.

## Portarium Meaning

The static evidence-card validator work is useful, but it still does not justify
product ingestion.

What the result supports:

- the static `EngineeringEvidenceCardInputV1` contract is still the right R&D
  boundary;
- private-oracle checks for malformed input, raw payload keys, unsafe artifact
  refs, and action-boundary consistency are necessary;
- blocked evidence cards must remain valid when the action boundary is blocked.

What it does not support:

- live Cockpit cards from prompt-language manifests;
- a service, queue, database table, or ingestion path for GSLR manifests;
- local or advisor routing as a default for evidence-card validation;
- MC connector observation or school-data movement.

## Next Product Boundary

Portarium should wait for GSLR-5 before considering any product-facing evidence
card work beyond docs/test parser hardening.

GSLR-5 should test raw-payload adversarial ambiguity. That is closer to
Portarium's real governance risk than another mechanical schema validator.

## Sources

- Prompt-language GSLR-4 live result:
  `experiments/harness-arena/results/gslr4-live-2026-05-12/report.md`
- Prompt-language post-GSLR-4 decision:
  `docs/evaluation/2026-05-12-post-gslr4-research-decision.md`
- Prompt-language route policy:
  `experiments/harness-arena/gslr-policy-schema-routing-policy.v1.json`

## Execution Record

2026-05-12:

- Recorded the GSLR-4 live result.
- Kept runtime ingestion and live Cockpit cards blocked.
- Recorded the next useful fixture as GSLR-5 raw-payload adversarial evidence.
