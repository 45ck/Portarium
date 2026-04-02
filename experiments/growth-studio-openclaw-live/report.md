# Growth Studio OpenClaw Live Report

## Latest Run

- Date: `2026-04-02`
- Outcome: `refuted` for the full end-to-end Growth Studio rehearsal
- Reason: the live OpenRouter call failed before the model could issue any tool calls

## Confirmed

- The experiment runner created an isolated OpenClaw profile under `results/runtime/`.
- The Portarium control plane started successfully in dev stub mode on a free local port.
- `openclaw plugins doctor` passed with `No plugin issues detected.`
- The Portarium governance plugin registered successfully for workspace
  `ws-growth-studio-live`.
- The OpenRouter credential was discovered locally and injected into the isolated runtime config.

## Blocker

The live agent turn failed at the provider boundary with:

```text
403 Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
```

Because the provider rejected the model call before inference began:

- no `read:file` tool calls were emitted
- no `write:file` mutations were proposed
- no Portarium approvals were created
- no evidence records were generated for the run
- no Growth Studio output files were written

## Result Artifacts

The raw local artifacts for this run were captured under `results/`:

- `run-context.json`
- `plugin-doctor.log`
- `control-plane.log`
- `agent.stdout.log`
- `agent.stderr.log`
- `approvals.json`
- `evidence.json`
- `outcome.json`

## Interpretation

This run proves the repo-side experiment path is wired correctly up to the live model boundary. The
remaining failure is not a Portarium/OpenClaw integration defect in this branch; it is an external
OpenRouter quota issue on the only key discoverable on this machine.

## Next Step

Re-run `node node_modules/tsx/dist/cli.mjs experiments/growth-studio-openclaw-live/run.mjs` after
replacing or recharging the local OpenRouter key. The experiment folder is ready to produce the
full approval and output bundle once the provider accepts inference requests again.
