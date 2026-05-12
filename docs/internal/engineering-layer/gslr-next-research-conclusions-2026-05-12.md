<!-- cspell:words FrugalGPT RouteLLM LLMLingua Qwen Ollama vLLM -->

# GSLR Next Research Conclusions: 2026-05-12

Status: R&D governance boundary, not product integration  
Tracking bead: `bead-1234`  
Companion prompt-language bead: `prompt-language-gslr9`

## Decision

Do not build Portarium runtime ingestion yet.

Do not build the live Cockpit evidence card yet.

The next work belongs in prompt-language as a fixture-family ladder:

1. `gslr3-policy-manifest-transform`
2. `gslr4-two-file-validator`
3. `gslr5-raw-payload-adversarial`

Portarium should wait for those results, then build a static evidence-card
schema before any runtime connection.

## Why

The external literature and the internal runs now agree on the same point:
agentic engineering systems work when the work item has a strong interface,
explicit route policy, executable gates, observable artifacts, and a reviewable
decision boundary.

OpenAI Symphony validates board-driven agent orchestration. OpenAI harness
engineering validates repository-local knowledge, tests, observability, and
agent-legible feedback loops. FrugalGPT and RouteLLM validate measured routing
as a cost-control idea. SWE-agent validates that agent-computer interfaces
matter. Prompt-program and prompt-compression systems such as DSPy and
LLMLingua validate the idea that prompts should become measurable programs, not
unbounded prose.

GSLR-2 adds the local evidence:

| Arm             | Result | Frontier tokens |
| --------------- | ------ | --------------- |
| `local-only`    | pass   | 0               |
| `frontier-only` | pass   | 45,713          |
| `advisor-only`  | pass   | 15,301          |
| `hybrid-router` | pass   | 91,279          |

The conclusion is not "hybrid wins". It is:

```text
For tiny one-file policy/schema tasks with strong gates, local-screen is the
best current route. Hybrid review is a governance choice, not a default cost
saver.
```

## Product Implication

Portarium's product wedge should not be "we start agents from a board". That is
now visible prior art.

Portarium's wedge should be:

```text
governed route decisions and action-boundary approval backed by evidence
manifests that operators can inspect and trust.
```

That means the first Cockpit evidence card must show why a bead used
local-only, advisor-only, frontier-only, or hybrid review. It should not just
show which model ran.

## Static Evidence Card Fields To Wait For

The static card should wait until GSLR3-5 can populate:

- task shape;
- route decision;
- selected model;
- public gate result;
- private oracle result;
- final verdict;
- review defects;
- local resource telemetry;
- frontier token telemetry;
- cached-token telemetry when available;
- product-action boundary: blocked, approved, or research-only.

## Boundary

Runtime ingestion remains blocked.

Cockpit live cards remain blocked.

MC connector observation remains blocked.

The next acceptable Portarium work is only a static card schema after
prompt-language runs the fixture family and records stable route-policy fields.

## Sources

- Prompt-language next conclusion:
  `docs/evaluation/2026-05-12-gslr-next-research-conclusions.md`
- Prompt-language route policy:
  `experiments/harness-arena/gslr-policy-schema-routing-policy.v1.json`
- Prompt-language fixture-family plan:
  `experiments/harness-arena/GSLR-POLICY-SCHEMA-FAMILY-PLAN.md`
- OpenAI Symphony:
  <https://openai.com/index/open-source-codex-orchestration-symphony/>
- OpenAI harness engineering:
  <https://openai.com/index/harness-engineering/>
- OpenAI model docs:
  <https://developers.openai.com/api/docs/models>
- OpenAI prompt caching:
  <https://developers.openai.com/api/docs/guides/prompt-caching>
- FrugalGPT:
  <https://arxiv.org/abs/2305.05176>
- RouteLLM:
  <https://openreview.net/forum?id=8sSqNntaMr>
- SWE-agent:
  <https://arxiv.org/abs/2405.15793>

## Execution Record

2026-05-12:

- Re-checked external and internal research evidence after GSLR-2 route-policy
  codification.
- Recorded that Portarium product work should wait for the GSLR3-5
  fixture-family ladder.
- Kept runtime ingestion, live Cockpit evidence cards, and MC connector
  observation blocked.
