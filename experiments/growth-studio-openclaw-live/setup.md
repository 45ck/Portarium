# Setup

## Purpose

This experiment runs a live OpenClaw agent against a local Portarium control plane and records the
full Growth Studio rehearsal output.

## What the runner does

`run.mjs` performs the full setup automatically:

1. Creates an isolated OpenClaw config and state directory under `results/runtime/`.
2. Copies the committed fixture inputs into an isolated agent workspace.
3. Starts the Portarium control plane in dev stub mode on a free local port.
4. Launches `openclaw agent --local` with the Portarium governance plugin enabled.
5. Polls Portarium for pending approvals and approves them using a separate operator token.
6. Captures raw logs, approvals, evidence, output file snapshots, and the final runner outcome.

## Credential discovery

The runner looks for an OpenRouter API key in this order:

1. `OPENROUTER_API_KEY`
2. `%USERPROFILE%/.openclaw/.env`
3. `D:/CLAW/context/openclaw.json`

The key is only written into the generated runtime config inside `results/runtime/`, which is
gitignored.

## Running

From the repo root:

```bash
node node_modules/tsx/dist/cli.mjs experiments/growth-studio-openclaw-live/run.mjs
```

Optional overrides:

```bash
OPENROUTER_MODEL=openrouter/minimax/minimax-m2.5
PORTARIUM_TENANT_ID=default
```

## Result files

Raw run artifacts are written under:

```text
experiments/growth-studio-openclaw-live/results/
```

Important files:

- `outcome.json`
- `run-context.json`
- `control-plane.log`
- `agent.stdout.log`
- `agent.stderr.log`
- `plugin-doctor.log`
- `approvals.json`
- `evidence.json`
- `outputs.snapshot.json`

`report.md` is the committed summary of the latest confirmed run captured for this bead.
