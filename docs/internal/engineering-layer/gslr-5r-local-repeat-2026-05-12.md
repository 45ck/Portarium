# GSLR-5R Local Repeat Result: 2026-05-12

Status: R&D repeat result, not runtime ingestion  
Tracking bead: `bead-1243`  
Companion prompt-language bead: `prompt-language-gslr18`

## Decision

Prompt-language ran the repaired GSLR-5 local lane three more times with the
same fixture, same private oracle, zero frontier tokens, and local resource
snapshots.

Result:

- repeat 1 failed by accepting a source payload raw key;
- repeat 2 failed by accepting an unsafe `../private/raw-dump.json` artifact
  ref;
- repeat 3 failed by accepting a source payload raw key;
- route remains `frontier-baseline`.

## Portarium Meaning

The single repaired local pass was not stable. This matters more than the pass:
privacy-sensitive evidence-card work cannot be promoted on a lucky local sample.

What it supports:

- the current local lane is useful as a failure-discovery tool;
- the next local attempt should use a stronger PL contract or scaffolded
  sanitizer skeleton;
- raw-key scanning and artifact-ref validation should be fixed helper contracts,
  not free-form natural-language implementation instructions.

What it does not support:

- live Cockpit cards from prompt-language manifests;
- a service, queue, database table, or ingestion path for GSLR manifests;
- local routing as the selected default for privacy-sensitive evidence cards;
- MC connector observation or school-data movement.

## Next Product Boundary

Portarium product work remains docs/test-only.

The next research step is to test a scaffolded sanitizer contract where the
local model fills isolated predicates or policy tables rather than writing the
whole sanitizer from scratch.

Follow-up: `gslr-6-scaffolded-sanitizer-decision-2026-05-12.md` records that
next step as a docs/R&D contract-shape test only. It does not authorize runtime
ingestion, live Cockpit cards, or MC connector work.

## Sources

- Prompt-language GSLR-5R repeat result:
  `experiments/harness-arena/results/gslr5r-local-repeat-2026-05-12/report.md`
- Prompt-language route policy:
  `experiments/harness-arena/gslr-policy-schema-routing-policy.v1.json`

## Execution Record

2026-05-12:

- Recorded the GSLR-5R repeat result.
- Kept runtime ingestion and live Cockpit cards blocked.
- Recorded that the repaired local lane is not repeat-stable.
