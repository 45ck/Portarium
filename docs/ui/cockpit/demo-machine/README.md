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
demo-machine run docs/ui/cockpit/demo-machine/clips/01-approval-gate-unblocks-run.demo.yaml --output ./output/cockpit-demo
```

Each clip spins up the local Cockpit lo-fi prototype with:

`npx --yes http-server docs/ui/cockpit -p 4174`

## Approvals V2 Showcase Media

Render the approvals-v2 showcase GIF and MP4 (for README embedding):

```bash
npm run cockpit:demo:approvals-v2:showcase
```

Outputs:

- `docs/ui/cockpit/demo-machine/showcase/approvals-v2-approval-gate.gif`
- `docs/ui/cockpit/demo-machine/showcase/approvals-v2-approval-gate.json`
