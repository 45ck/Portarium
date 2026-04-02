# Setup

## Purpose

This experiment runs the official OpenClaw CLI against a local Portarium control plane and records
the full Growth Studio rehearsal output.

Official references:

- `https://openclaw.ai/`
- `https://github.com/openclaw/openclaw`

## What the runner does

`run.mjs` performs the full setup automatically:

1. Creates an isolated OpenClaw config and state directory under `results/runtime/`.
2. Creates an isolated OpenClaw home directory under `results/runtime/home/` so the run does not
   depend on the host `~/.openclaw` profile.
3. Renders the committed `repro/openclaw.template.json` into an isolated `openclaw.json`.
4. Copies the committed fixture inputs into an isolated agent workspace.
5. Starts the Portarium control plane in dev stub mode on a free local port.
6. Records `openclaw --version`, runs `openclaw plugins doctor`, and captures `openclaw doctor`.
7. Launches `openclaw agent --local` with the Portarium governance plugin enabled.
8. Polls Portarium for pending approvals and approves them using a separate operator token.
9. Captures raw logs, approvals, evidence, output file snapshots, `timeline.ndjson`, and the final
   runner outcome.

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
npm run experiment:growth-studio:live
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
- `timeline.ndjson`

`report.md` is the committed summary of the latest confirmed run captured for this bead.
`repro/` contains the tracked OpenClaw config template and reproduction notes kept in Git.

The tracked template uses `plugins.entries.portarium.config`, matching the plugin's exported
OpenClaw id and manifest id.
