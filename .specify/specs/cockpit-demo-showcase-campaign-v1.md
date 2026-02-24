# Spec: Cockpit Demo Showcase Campaign — Scripted Governance Demos + Integration Readiness (v1)

**Bead:** bead-0724 (campaign parent)
**Child beads:** bead-0725 (locator hardening), bead-0726 (demo-machine scripts), bead-0727 (media pipeline), bead-0728 (CI automation), bead-0729 (docs), bead-0730 (integration showcase L2), bead-0731 (trust hardening), bead-0732 (launch kit)

## Context

Portarium Cockpit requires scripted, reproducible governance demos that can be captured as video/GIF artifacts for
documentation, onboarding, and sales enablement. The demo showcase campaign delivers six demo-machine clip scripts,
a CI-validated media pipeline, integration readiness documentation, and a demo launch kit.

## Requirements

### Track A — Demo machine scripts

1. Six clip scripts must exist under `docs/internal/ui/cockpit/demo-machine/clips/`:
   - `01-approval-gate-unblocks-run.demo.yaml` — approval gate governance story
   - `02-evidence-chain-update-on-decision.demo.yaml` — evidence chain update on approval decision
   - `03-correlation-context-traversal.demo.yaml` — correlation context traversal
   - `04-capability-matrix-connector-posture.demo.yaml` — capability matrix and connector posture
   - `05-degraded-realtime-safety-ux.demo.yaml` — degraded real-time safety UX
   - `06-agent-integration-quickstart.demo.yaml` — agent integration quickstart
2. Each script must use stable `data-testid` locators defined in `docs/internal/ui/cockpit/demo-bindings.js`.
3. All scripts must be YAML files parseable by the demo-machine runner.

### Track B — Demo locator hardening (bead-0725)

4. All Cockpit components used in demo scripts must expose `data-testid` attributes matching the bindings in `docs/internal/ui/cockpit/demo-bindings.js`.
5. No script may rely on positional CSS selectors that change across viewport sizes.

### Track C — Media pipeline (bead-0727 / bead-0728)

6. Showcase media artifacts (MP4 + GIF) must be produced under `docs/internal/ui/cockpit/demo-machine/showcase/`.
7. CI automation must validate all six clip scripts parse correctly (`npm run demo:validate` or equivalent).
8. Redaction checks must be enforced on all demo captures (no real credentials, PII, or internal URLs).

### Track D — Docs and integration showcase (bead-0729 / bead-0730)

9. `docs/how-to/run-cockpit-demos-locally.md` must document prerequisites, env setup, and step-by-step capture instructions.
10. `docs/integration/demo-walkthrough.md` must cover integration ladder levels L0-L3.
11. `docs/demo-handoff-hello-connector.md` must provide a hello-connector scaffold for the Level-2 integration demo.

### Track E — Launch kit (bead-0732)

12. `docs/how-to/demo-launch-kit.md` must include outreach templates, a publish checklist, and post-launch metrics definition.

## Test coverage required

- `supply-chain-guardrails.test.ts`: demo script YAML files must not contain hardcoded secrets or PII patterns.
- Demo CI validation (`bead-0728`): all six clip scripts must parse without errors in CI.
- Trust hardening (`bead-0731`): redaction check integrated into demo capture pipeline.

## Review signal

Campaign reviewed against Cockpit demo architecture. All eight child beads (bead-0725 through bead-0732) closed and merged to main.

## Docs

- `docs/how-to/run-cockpit-demos-locally.md` — local demo setup guide
- `docs/how-to/demo-launch-kit.md` — outreach and publish checklist
- `docs/integration/demo-walkthrough.md` — integration ladder walkthrough
- `docs/demo-handoff-hello-connector.md` — hello-connector L2 demo scaffold
- `docs/internal/ui/cockpit/demo-machine/clips/` — the six canonical demo clip scripts
- `docs/internal/ui/cockpit/demo-machine/showcase/` — rendered media artifacts

## Acceptance

- All child beads (bead-0725 through bead-0732) are closed.
- Six demo-machine clip YAML files are present and valid.
- Demo showcase media exists in `docs/internal/ui/cockpit/demo-machine/showcase/`.
- `npm run ci:pr` passes with no demo-related failures.
- `docs/how-to/run-cockpit-demos-locally.md` and `docs/how-to/demo-launch-kit.md` are present.
