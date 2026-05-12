<!-- cspell:ignore FrugalGPT RouteLLM SGLang Agentless -->

# GSLR-6 Scaffolded Sanitizer Decision: 2026-05-12

Status: exact local-screen R&D result, not runtime ingestion
Tracking bead: `bead-1246`
Companion prompt-language bead: `prompt-language-gslr21`

## Decision

Portarium should treat `gslr6-scaffolded-sanitizer` as an exact `local-screen`
R&D route.

Portarium should still keep broader privacy-sensitive, free-form, runtime, or
product-ingestion evidence-card sanitization on `frontier-baseline`.

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

## Live Local Repeat Update

Prompt-language then ran the live local lane.

The first two local attempts failed before the clean repeat set:

- v1 implemented helpers but did not export them;
- v2 exported helpers but copied the public-gate import into the target file,
  creating a self-import and duplicate declarations.

After the lane made those model-visible boundaries explicit, the v3 lane passed
all three local repeats:

| Repeat | Final verdict | Private oracle | Frontier tokens | Step wall time |
| ------ | ------------- | -------------- | --------------- | -------------- |
| 1      | pass          | pass           | 0               | 75.301s        |
| 2      | pass          | pass           | 0               | 51.215s        |
| 3      | pass          | pass           | 0               | 52.569s        |

Portarium meaning: this supports the engineering-system pattern of local
bounded implementation under fixed helper contracts, with frontier/Codex as the
advisor or escalation route on first failure. It does not authorize runtime
manifest ingestion, live Cockpit cards, queues, tables, or MC connector work.

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
- Prompt-language GSLR-6 local-repeat result:
  `experiments/harness-arena/results/gslr6-local-repeat-2026-05-13/report.md`
- Prompt-language GSLR-5R repeat result:
  `experiments/harness-arena/results/gslr5r-local-repeat-2026-05-12/report.md`

## Execution Record

2026-05-12:

- Recorded GSLR-6 as the next research step.
- Kept Portarium product work docs/test-only.
- Kept runtime ingestion and live Cockpit cards blocked.

2026-05-13:

- Recorded the GSLR-6 deterministic scaffold proof.
- Recorded the GSLR-6 live local repeat result: v3 passed three repeats with
  zero frontier tokens, promoting the exact scaffolded static sanitizer shape to
  R&D `local-screen`.
- Kept runtime ingestion, live Cockpit cards, services, queues, database tables,
  and MC connector work blocked.
