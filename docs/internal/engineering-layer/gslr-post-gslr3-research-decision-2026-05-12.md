<!-- cspell:words FrugalGPT RouteLLM LLMLingua -->

# GSLR Post-GSLR-3 Research Decision: 2026-05-12

Status: R&D governance boundary, not product integration  
Tracking bead: `bead-1236`  
Companion prompt-language bead: `prompt-language-gslr11`

## Decision

Do not build Portarium runtime ingestion yet.

Do not build live Cockpit evidence cards yet.

Prompt-language should run GSLR-3 live `local-only` first. If that passes, it
should run one `frontier-only` baseline to price the frontier work avoided by
the local lane. `advisor-only` and `hybrid-router` should be conditional, not
automatic.

## Why

The GSLR-3 deterministic scaffold proved that a Harness Arena manifest can be
tested against a static Portarium evidence-card input shape. It did not prove
that a local model can perform the transform.

The important Portarium lesson is:

```text
blocked evidence is still evidence
```

A failed final verdict, failed private oracle, or blocking review defect should
still become a card with `actionBoundary.status: "blocked"`. Operators need a
reviewable blocked artifact, not a missing card.

External research points the same way. OpenAI Symphony validates issue-board
agent orchestration, but that is prior art. Harness engineering, RouteLLM,
FrugalGPT, SWE-agent, DSPy, LLMLingua, prompt caching, and local/open model docs
all point toward measured interfaces, routing, telemetry, and gates. Portarium's
wedge is the governed action boundary, not merely starting agents from a board.

## Product Implication

The future Cockpit evidence card should show:

- why the route was selected;
- whether public gates passed;
- whether the private oracle passed;
- whether review found blocking defects;
- local wall-time/resource evidence;
- frontier token and cached-token evidence;
- whether the product action is research-only, blocked, or approved.

It should not ingest raw payloads, hidden oracle bodies, tokens, credentials, or
connector data.

## Next Acceptable Work

Portarium should wait while prompt-language runs the live GSLR-3 local-first
sequence.

If GSLR-3 local-only passes and the frontier-only baseline quantifies meaningful
token avoidance, Portarium can draft a static evidence-card schema. That schema
must still be docs/test-only until the GSLR fixture family has more route-policy
coverage.

## Boundary

Runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

MC connector observation remains blocked.

No production Portarium action path should consume GSLR manifests yet.

## Sources

- Prompt-language post-GSLR-3 decision:
  `docs/evaluation/2026-05-12-post-gslr3-research-decision.md`
- Prompt-language GSLR-3 runbook:
  `experiments/harness-arena/GSLR-3-POLICY-MANIFEST-TRANSFORM-RUNBOOK.md`
- Prompt-language GSLR-3 deterministic result:
  `experiments/harness-arena/results/gslr3-fake-live-2026-05-12/report.md`
- OpenAI Symphony:
  <https://openai.com/index/open-source-codex-orchestration-symphony/>
- OpenAI Symphony specification:
  <https://github.com/openai/symphony/blob/main/SPEC.md>
- OpenAI harness engineering:
  <https://openai.com/index/harness-engineering/>
- OpenAI prompt caching:
  <https://developers.openai.com/api/docs/guides/prompt-caching>
- FrugalGPT:
  <https://arxiv.org/abs/2305.05176>
- RouteLLM:
  <https://openreview.net/forum?id=8sSqNntaMr>
- SWE-agent agent-computer interface:
  <https://swe-agent.com/0.7/background/aci/>

## Execution Record

2026-05-12:

- Created and closed `bead-1236`.
- Recorded the post-GSLR-3 decision after re-checking external research and
  internal GSLR evidence.
- Kept runtime ingestion, live Cockpit cards, and MC connector observation
  blocked.
- Follow-up: prompt-language live GSLR-3 evidence is now negative for
  local-screen and positive for frontier-only. Portarium should treat the static
  evidence-card transform as frontier-baseline until new local evidence exists.
