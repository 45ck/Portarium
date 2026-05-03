# Cockpit Demo-Machine Clips (bead-0726)

This folder contains six deterministic demo-machine specs for the core Cockpit showcase narratives:

1. Approval gate unblocks run
2. Evidence chain update on decision
3. Correlation/context traversal
4. Capability matrix connector posture
5. Degraded realtime safety UX
6. Agent integration quickstart storyline

All clips include:

- seeded precondition reset (`#demoResetButton`) before storyline actions
- reproducible cleanup reset at the end
- at least one screenshot artifact step

## Clip Specs

- `clips/01-approval-gate-unblocks-run.demo.yaml`
- `clips/02-evidence-chain-update-on-decision.demo.yaml`
- `clips/03-correlation-context-traversal.demo.yaml`
- `clips/04-capability-matrix-connector-posture.demo.yaml`
- `clips/05-degraded-realtime-safety-ux.demo.yaml`
- `clips/06-agent-integration-quickstart.demo.yaml`

## Run A Clip

Use your local demo-machine CLI against any clip:

```bash
demo-machine run docs/internal/ui/cockpit/demo-machine/clips/01-approval-gate-unblocks-run.demo.yaml --output ./output/cockpit-demo
```

Each clip spins up the local Cockpit lo-fi prototype with:

`npx --yes http-server docs/internal/ui/cockpit -p 4174`

## OpenClaw Approval Triage Mock

For modern Cockpit demo capture (MSW-backed app) with an OpenClaw-first approval queue:

```powershell
npm run cockpit:dev:openclaw-demo
```

Then open `http://cockpit.localhost:1355/approvals`.

Alternative fixed-port command for team QA tools:

```powershell
npm run cockpit:dev:e2e:openclaw-demo -- --host 127.0.0.1
```

If port `5173` is already in use:

```powershell
npm run cockpit:dev:e2e:openclaw-demo -- --port 5188 --host 127.0.0.1
```

### Suggested Recording Sequence (openclaw-demo)

Use these approvals in order from the queue:

1. `apr-oc-3201` — Heartbeat Watchtower: draft reply (approve)
2. `apr-oc-3202` — Heartbeat Watchtower: schedule follow-up (approve)
3. `apr-oc-3203` — Delete all emails safety test (deny; approve is blocked by policy role gate)
4. `apr-oc-3204` — Cron morning brief batch output (approve or request changes)
5. `apr-oc-3205` — Persistent cron creation (deny; approve is blocked by policy role gate)
6. `apr-oc-3206` — Sub-agent triage output (approve)

Key evidence entries to show in the Evidence panel:

- `evd-oc-4203` / `evd-oc-4204` — destructive email delete blocked with no execution
- `evd-oc-4206` / `evd-oc-4207` — persistent cron creation blocked + policy lock
- `evd-oc-4208` — isolated sub-agent result returned for approval

### Render OpenClaw MP4 Clips (Automated)

Generate three high-resolution OpenClaw demo clips (WEBM + MP4) with scripted triage actions:

```bash
npm run cockpit:demo:openclaw:clips
```

The renderer uses smooth cursor motion and slowed pacing so each approval decision is readable in recordings.

Outputs are written to:

- `qa-artifacts/openclaw-demo-videos/<timestamp>/01-heartbeat-watchtower/`
- `qa-artifacts/openclaw-demo-videos/<timestamp>/02-destructive-blocked/`
- `qa-artifacts/openclaw-demo-videos/<timestamp>/03-persistent-cron-and-subagent/`
- `qa-artifacts/openclaw-demo-videos/<timestamp>/manifest.json`

### Render iPhone Tinder-Style OpenClaw Showcase

Render a vertical iPhone-focused approval demo (policy-gated OpenClaw actions):

```bash
npm run cockpit:demo:openclaw:iphone
```

Published outputs:

- `docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.mp4`
- `docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.gif`
- `docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.json`
- `docs/internal/ui/cockpit/media/openclaw-heartbeat-watchtower-desktop.mp4`
- `docs/internal/ui/cockpit/media/openclaw-destructive-blocked-desktop.mp4`
- `docs/internal/ui/cockpit/media/openclaw-cron-subagent-desktop.mp4`

## Approvals V2 Showcase Media

Render the approvals-v2 showcase GIF and MP4 (for README embedding):

```bash
npm run cockpit:demo:approvals-v2:showcase
```

Outputs:

- `docs/internal/ui/cockpit/demo-machine/showcase/approvals-v2-approval-gate.gif`
- `docs/internal/ui/cockpit/demo-machine/showcase/approvals-v2-approval-gate.json`

## Software-First Multi-Project Showcase

Batch 12 adds a recording-ready, manifest-backed software-first autonomy
showcase under:

`examples/showcase/software-first-autonomy/`

It covers:

- mobile Approval Gate review with an explicit exception;
- desktop Project switching between a `demo-only` content Project and a
  `self-use` micro-SaaS Project;
- Policy, Evidence Log, and human intervention beats.

Run the static showcase locally:

```powershell
npx --yes http-server examples/showcase/software-first-autonomy -p 4184
```

Demo-machine specs:

- `examples/showcase/software-first-autonomy/software-first-autonomy.mobile.demo.yaml`
- `examples/showcase/software-first-autonomy/software-first-autonomy.desktop.demo.yaml`

Focused validation:

```powershell
node node_modules/vitest/vitest.mjs run src/presentation/ops-cockpit/software-first-autonomy-showcase.test.ts
```
