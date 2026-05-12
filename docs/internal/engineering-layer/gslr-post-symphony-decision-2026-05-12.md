# GSLR Post-Symphony Decision: 2026-05-12

Status: R&D decision record, not product integration  
Tracking bead: `bead-1230`  
Companion prompt-language bead: `prompt-language-gslr5`

## Decision

Continue the governed-Symphony local/frontier routing track, but do not build
Portarium runtime ingestion or a product-facing evidence card yet.

The next evidence-producing step belongs in prompt-language as GSLR-2: a tiny
code/schema task with matched controls, manifest final verdict, review-defect
accounting, and frontier token telemetry.

## Why

OpenAI's public Symphony write-up validates the broad shape of the idea:
project-management work can become the control plane for coding agents, with
isolated workspaces, continuous runs, and human review. That is useful
confirmation, but it also means "issue tracker starts agents" is no longer a
distinctive Portarium claim.

Portarium's claim must be stricter:

```text
Portarium governs consequential engineering actions before they happen, records
durable evidence, and gives operators a reviewable explanation of what each
agent was allowed to do and why.
```

Prompt Language's role is the executable contract inside that governed work
item. It should record route decisions, gates, artifacts, review findings, and
token/cost telemetry in a form Portarium can later render.

## What The Research Says

- OpenAI Symphony and harness engineering support board-level agent orchestration,
  but also emphasize guardrails, tests, docs, and feedback loops.
- FrugalGPT and RouteLLM make cost-aware routing credible, but only when routing
  is measured against quality and cost controls.
- DSPy, SGLang, LMQL, LLMLingua, and prompt caching show that cost reduction
  also comes from stable prompts, prompt compression, compiled pipelines,
  constrained outputs, and cache reuse.
- LangGraph, CrewAI, AutoGen, OpenAI Agents SDK, and HumanLayer-style systems
  make orchestration, handoffs, tracing, and human approval common platform
  primitives.
- OpenAI-compatible local inference servers and OpenAI `gpt-oss` make local
  inference practical, but local output still needs validation and escalation.

## What GSLR-1 Changed

GSLR-1 was a useful negative result:

- local-only passed the safe docs projection;
- frontier-only passed;
- advisor-only passed after calibration;
- hybrid passed the private oracle but had a blocking review defect and used
  more frontier work than the frontier-only control.

That means the next task must be harder than a docs projection and the cost
comparison must be fair. If final frontier review is mandatory, the
frontier-only control needs the same review step, or the report must separate
implementation tokens from mandatory review tokens.

## Product Boundary

Portarium remains the governance target and future evidence consumer. It should
not ingest runner events yet.

The static Cockpit evidence card is unblocked only after a GSLR-2 manifest has:

- `finalVerdict.status == "pass"`;
- no unresolved blocking review defects;
- public gate and private oracle pass;
- frontier token telemetry;
- a matched-control cost comparison showing hybrid value.

## Next Step

Prompt-language should implement and run GSLR-2:

1. one tiny schema or validation-rule change;
2. one implementation file;
3. one public test file;
4. one hidden oracle;
5. four arms: `local-only`, `frontier-only`, `advisor-only`, `hybrid-router`;
6. route-policy reasons in the manifest;
7. no hidden human repair.

If GSLR-2 is positive, Portarium should build a static evidence-card mock from
the manifest. If it is negative, improve the route policy and fixture before
building product ingestion.

## Sources

- Prompt-language post-Symphony decision:
  `docs/evaluation/2026-05-12-post-symphony-research-decision.md`
- OpenAI, "An open-source spec for Codex orchestration: Symphony":
  <https://openai.com/index/open-source-codex-orchestration-symphony/>
- OpenAI, "Harness engineering: leveraging Codex in an agent-first world":
  <https://openai.com/index/harness-engineering/>
- OpenAI API, Prompt caching:
  <https://platform.openai.com/docs/guides/prompt-caching>
- FrugalGPT:
  <https://arxiv.org/abs/2305.05176>
- RouteLLM:
  <https://openreview.net/forum?id=8sSqNntaMr>
- DSPy:
  <https://arxiv.org/abs/2310.03714>
- SGLang:
  <https://arxiv.org/abs/2312.07104>

## Execution Record

2026-05-12:

- Created and claimed `bead-1230`.
- Recorded the post-Symphony conclusion and Portarium product boundary.
- Kept runtime ingestion and product evidence-card work blocked on positive
  GSLR-2 manifest evidence.
- Closed `bead-1230` after the decision record and links were added.
