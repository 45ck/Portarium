# GSLR Research Synthesis: 2026-05-12

Status: R&D decision record, not product integration  
Tracking bead: `bead-1227`  
Companion prompt-language bead: `prompt-language-gslr2`

## Conclusion

The governed-Symphony idea is worth continuing, but the center of gravity has
changed.

The strong claim is not "run engineering with a swarm of local models". The
strong claim is:

```text
Portarium can govern autonomous engineering work the same way it governs other
agent actions: with intent, policy, approvals, audit evidence, and operator
review. Prompt Language supplies the executable contract inside each work item.
```

Local models are a cost-control and bulk-work lane. They are not the trusted
authority for ambiguous architecture, security, production mutations, or final
acceptance.

## Research Read

### OpenAI Symphony and Codex

OpenAI Symphony validates the board-as-orchestrator pattern: project work can be
split into isolated autonomous implementation runs. That overlaps with
Portarium's engineering-layer direction, but it does not replace Portarium's
wedge.

Portarium's wedge remains policy at the action boundary:

- which work item is allowed to run;
- what sandbox it may use;
- which tools and files it may touch;
- when a human must approve;
- what evidence is durable after the run.

OpenAI's Codex App Server material is important because it exposes the Codex
harness through structured JSONL-framed JSON-RPC events. If Portarium later
integrates Codex directly, the stable event/protocol surface is more credible
than scraping terminal output.

### Routing and cascade research

FrugalGPT, RouteLLM, and related routing work support the general economics:
route easy work to cheaper models and reserve stronger models for hard cases.
That does not automatically prove the Portarium/PL case because software work
has diffs, tools, tests, hidden oracles, security boundaries, and human
acceptance.

The lesson is to measure routing per work item, not assume it.

### Software-agent research

SWE-agent, AutoCodeRover, and Agentless all point in the same direction:

- interface shape matters;
- localization and validation matter;
- simple baselines are hard to beat;
- more autonomous steps are not automatically better.

For Portarium, this argues against starting with a large multi-agent cockpit.
Start with a tiny manifest-backed evidence card that can compare the hybrid
router against local-only, frontier-only, and advisor-only controls.

### Prompt-programming systems

LMQL, SGLang, DSPy, and related systems show that "prompts as programs" is a
real technical direction. Prompt Language's differentiator should therefore not
be syntax novelty. The differentiator is that a Portarium bead can have an
operator-readable execution contract with gates, retries, artifacts, approvals,
and evidence.

### Governance literature

NIST AI RMF and current agent-governance grey literature keep returning to the
same operational needs: auditability, human oversight, traceability, and
controls near the point of action.

This supports Portarium's existing direction. Governance after a diff is written
is weaker than governance before a consequential tool call executes.

## What The Current Scaffold Proves

The 2026-05-12 GSLR-1 scaffold proves:

- a no-mutation MacquarieCollege projection scenario can be represented without
  raw vertical payloads;
- the four-arm experiment shape is concrete;
- the evidence package fields are named;
- the public gate and manifest shape can be checked before product integration.

It does not prove:

- hybrid routing saves money;
- local-only models are good enough;
- Codex/Symphony integration is required;
- Portarium should ingest live runs now;
- school-ops workflows are ready for mutation.

## Product Decision

Do not build runtime ingestion yet.

The next product-adjacent artifact should be a static Cockpit evidence card only
after a prompt-language live run produces a positive manifest. GSLR-1 live did
not meet that bar; see `gslr-1-live-result-2026-05-12.md`.

Follow-up after current OpenAI Symphony and routing-literature review:
`gslr-post-symphony-decision-2026-05-12.md`. That record keeps the same product
boundary but sharpens the next run: GSLR-2 must use a code/schema task, matched
frontier-review cost accounting, manifest route-policy reasons, and token
telemetry before Portarium renders product evidence.

## Next Build Sequence

1. prompt-language locks the GSLR-1 private oracle outside model-visible input.
2. prompt-language runs all four arms:
   `local-only`, `frontier-only`, `advisor-only`, `hybrid-router`.
3. The run report records pass/fail, review defects, frontier-call counts, wall
   time, budget, and manifest completeness.
4. If `hybrid-router` passes and uses fewer frontier calls than
   `frontier-only`, Portarium creates a static evidence-card mock from that
   manifest.
5. Only after the static card is useful should Portarium evaluate direct runner
   ingestion, Codex App Server integration, or Symphony-style scheduling.

## Stop Conditions

Stop or narrow the track if:

- hybrid only passes because of hidden human repair;
- local-only receives frontier leakage;
- the manifest cannot explain why a route decision happened;
- the private oracle catches raw MC payloads or unsafe source-system references;
- the static evidence card cannot make the run understandable to an operator.

## Sources

- OpenAI Symphony repository:
  <https://github.com/openai/symphony>
- OpenAI, "Unlocking the Codex harness: how we built the App Server":
  <https://openai.com/index/unlocking-the-codex-harness/>
- FrugalGPT:
  <https://arxiv.org/abs/2305.05176>
- RouteLLM:
  <https://arxiv.org/abs/2406.18665>
- SWE-agent:
  <https://arxiv.org/abs/2405.15793>
- AutoCodeRover:
  <https://arxiv.org/abs/2404.05427>
- Agentless:
  <https://arxiv.org/abs/2407.01489>
- DSPy:
  <https://arxiv.org/abs/2310.03714>
- SGLang:
  <https://arxiv.org/abs/2312.07104>
- NIST AI Risk Management Framework:
  <https://www.nist.gov/itl/ai-risk-management-framework>

## Execution Record

2026-05-12:

- Created and claimed `bead-1227`.
- Recorded the research synthesis and product decision.
- Kept Portarium runtime ingestion blocked on a positive live GSLR-1 manifest.
- Closed `bead-1227` after the synthesis docs were added and linked.
- Added GSLR-1 live-result follow-up under `bead-1228`; product integration
  remains blocked.
- Added post-Symphony decision follow-up under `bead-1230`; board-level
  orchestration is now treated as validated prior art, while Portarium's
  differentiator remains governed evidence at the action boundary.
