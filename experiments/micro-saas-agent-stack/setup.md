# Setup

## Purpose

This experiment pack defines the next governed autonomy slice after the Growth Studio live run.

The goal is to validate a longer micro-SaaS lifecycle with:

- OpenClaw as the agent runtime
- Portarium as the governance and evidence layer
- Cockpit as the operator review surface
- local sibling repos as agent tools and harnesses

## Tool roles in this slice

| Tool repo           | Role in this experiment                                 |
| ------------------- | ------------------------------------------------------- |
| `OpenClaw/openclaw` | Agent runtime and local session loop                    |
| `content-machine`   | Content production tool for campaign and media outputs  |
| `demo-machine`      | Demo asset generator after the flow is validated        |
| `manual-qa-machine` | Preferred browser-based verifier and evidence collector |
| `prompt-language`   | Optional long-run loop, gating, and retry harness       |

The runner attempts `manual-qa-machine` first. If the local `agent-browser` launcher fails on this
Windows host, the failure is recorded and a Playwright fallback completes the black-box browser
verification so the experiment still captures funnel and analytics evidence.

## Stubbed external systems

This experiment must fail closed against local stub systems:

- fake social publisher
- fake email outbox and fake inbox replies
- fake CRM lead and queue state
- fake analytics event sink

The agent may draft and queue outbound actions, but no live send or publish is allowed in this
slice.

## Prerequisites

- [ ] Portarium control plane available locally or via the existing dev stub runner
- [ ] OpenClaw CLI installed on the machine that runs the experiment
- [ ] Local sibling repos available at the paths listed in `repro/.env.example`
- [ ] Live model credentials available for either OpenRouter or OpenAI
- [ ] Cockpit available when approval UI review is needed

## Environment variables

See `repro/.env.example`.

Key defaults are local filesystem paths so the experiment can be reproduced on this workstation
without guessing tool locations.

Model-provider selection is explicit:

- `MICRO_SAAS_MODEL_PROVIDER=openrouter` uses `OPENROUTER_API_KEY`
- `MICRO_SAAS_MODEL_PROVIDER=openai` uses `OPENAI_API_KEY`

## Planned execution tiers

- `Auto`: local reads, analysis, artifact drafting, fixture inspection
- `Human-approve`: publish/send actions, outbound queue transitions, final release of demo assets
- `Manual-only`: any action that would touch a real external audience or production account
