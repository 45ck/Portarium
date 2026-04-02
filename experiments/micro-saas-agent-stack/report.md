# Micro-SaaS Agent Stack Report

## Latest Run

- Date: 2026-04-02T18:27:29Z
- Outcome: `confirmed`
- Runtime: `173552ms`
- Provider: `openai`
- Model: `openai/gpt-5.2`
- OpenClaw CLI: `2026.2.12`

## What Ran

- OpenClaw ran the governed actor loop against the sealed micro-SaaS workspace.
- Portarium intercepted governed `read`, `write`, and `exec` tool calls and auto-approved risky actions with a separate operator identity.
- `content-machine` was invoked through the local helper tool and produced `content-machine-script.json`.
- `manual-qa-machine` was attempted first and failed on this workstation because `agent-browser` could not auto-launch Chrome.
- The runner recorded that host failure and completed the browser verification with the built-in Playwright fallback.

## Measured Results

- Approvals created and approved: `33`
- Evidence records captured: `90`
- Governed tool calls observed: `read`, `exec`, `write`
- Output artifacts created: `8`
- Stub email queued: `1`
- Stub social posts queued: `3`
- CRM state advanced: `lead-001 -> outreach_queued`
- Analytics events captured during QA:
  - `page_view`
  - `cta_click`
  - `signup_start`
  - `signup_complete`

## Result Artifacts

- `results/outcome.json`
- `results/timeline.ndjson`
- `results/run-context.json`
- `results/toolchain-manifest.json`
- `results/approvals.json`
- `results/evidence.json`
- `results/outputs.snapshot.json`
- `results/stub-state.after-agent.json`
- `results/stub-state.after-qa.json`
- `results/manual-qa/`
- `results/manual-qa.stderr.log`
- `results/playwright-qa/qa-report.json`
- `results/playwright-qa/final-state.png`

## Interpretation

The experiment is confirmed.

The governed OpenClaw actor completed the full stubbed launch rehearsal, staged outbound actions
behind Portarium approvals, wrote the landing page and content bundle, and updated the fake CRM,
email, social, and analytics systems without any live external dispatch.

On this host, `manual-qa-machine` remains toolchain-ready but its `agent-browser` launcher is not
stable enough to complete a browser run. That failure is preserved in the result bundle and the
Playwright fallback completed the independent black-box verification so the run still has
reproducible browser evidence.

## Flaws Found

- The preferred independent verifier, `manual-qa-machine`, is not yet reliable on this Windows host
  because `agent-browser` cannot auto-launch Chrome consistently.
- The browser fallback initially over-classified benign analytics `net::ERR_ABORTED` noise as test
  failure, so the verifier oracle itself needed hardening.
- `demo-machine` is present in the local repo set but is not runnable in this workstation setup, so
  the full "generate demo after validation" path remains unproven.

## Threats To Validity

- Publish and send actions were queued into stub systems, not dispatched to real systems.
- The run used automated operator approval rather than a real human review decision.
- Browser verification succeeded through the fallback verifier, not through the preferred
  `manual-qa-machine` path.
