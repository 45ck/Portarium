<!-- cspell:ignore FrugalGPT RouteLLM SGLang Agentless -->

# GSLR-6 Scaffolded Sanitizer Decision: 2026-05-12

Status: R&D decision, not runtime ingestion  
Tracking bead: `bead-1244`  
Companion prompt-language bead: `prompt-language-gslr19`

## Decision

Portarium should keep privacy-sensitive evidence-card sanitization on
`frontier-baseline`.

The next prompt-language experiment is GSLR-6: a scaffolded sanitizer contract.
That means the local model should fill fixed helper predicates or small policy
tables, not write the whole sanitizer from a free-form prompt.

## Why

GSLR-5R rejected local route promotion. The repaired local lane passed once,
then failed all three repeats with zero frontier tokens:

- two repeats accepted a source payload raw key;
- one repeat accepted an unsafe raw-dump parent-traversal artifact ref.

This is useful evidence. It says the failure is not just missing prose in the
prompt. The work needs a stronger contract shape.

External research points the same way:

- OpenAI Symphony makes board-to-agent orchestration prior art.
- OpenAI harness engineering emphasizes scaffolding, feedback loops, and control
  systems.
- OpenAI Agents SDK guardrails support blocking checks before expensive or
  side-effectful work.
- FrugalGPT and RouteLLM support measured routing, not unmeasured local-first
  optimism.
- SWE-agent and Agentless both warn that interface shape and simple
  validation-first baselines matter.
- DSPy, LMQL, and SGLang make prompt-programming prior art; Portarium's wedge is
  governed evidence at the action boundary.
- NIST AI RMF supports traceability, oversight, and risk controls before
  consequential action.

## Portarium Meaning

GSLR-6 is allowed as an R&D input to the engineering-layer evidence program.

It is not allowed to create:

- a GSLR manifest ingestion service;
- a queue or database table for live runner events;
- live Cockpit cards;
- runtime policy decisions based on prompt-language manifests;
- MC connector observation or school-data movement.

## Scaffold Proof Update

Prompt-language now has the GSLR-6 scaffold and deterministic fake-live proof:

- model-visible fixture;
- fixed helper-boundary public gate;
- private oracle checking helper exports and sanitizer behavior;
- deterministic lane;
- runner coverage;
- fake-live result with private oracle pass and final verdict pass.

This is harness-plumbing evidence only. It is not local-model evidence and does
not change the Portarium product boundary.

## Acceptance Bar Before Product Work

Portarium should consider a static evidence-card follow-up only if
prompt-language records:

- fixed sanitizer helper boundaries;
- unchanged or stricter hidden oracle;
- three local repeats;
- zero frontier tokens;
- public gate pass;
- private oracle pass;
- manifest final verdict pass;
- no oracle leakage;
- explicit route-policy update naming the exact scaffolded task shape.

Anything weaker keeps the result as research only.

## Sources

- Prompt-language post-GSLR-5R decision:
  `docs/evaluation/2026-05-12-post-gslr5r-scaffolded-sanitizer-decision.md`
- Prompt-language GSLR-6 runbook:
  `experiments/harness-arena/GSLR-6-SCAFFOLDED-SANITIZER-RUNBOOK.md`
- Prompt-language GSLR-6 fake-live result:
  `experiments/harness-arena/results/gslr6-fake-live-2026-05-13/report.md`
- Prompt-language GSLR-5R repeat result:
  `experiments/harness-arena/results/gslr5r-local-repeat-2026-05-12/report.md`

## Execution Record

2026-05-12:

- Recorded GSLR-6 as the next research step.
- Kept Portarium product work docs/test-only.
- Kept runtime ingestion and live Cockpit cards blocked.

2026-05-13:

- Recorded the GSLR-6 deterministic scaffold proof.
- Kept live local repeats, route promotion, runtime ingestion, and live Cockpit
  cards blocked.
