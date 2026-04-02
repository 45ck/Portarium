# Reproduction Notes

This experiment treats sibling repos as local tools and harnesses available to the OpenClaw actor.

They are not automatically promoted into Portarium machine registrations in this slice.

## Local repo defaults

- `D:/Visual Studio Projects/OpenClaw/openclaw`
- `D:/Visual Studio Projects/content-machine`
- `D:/Visual Studio Projects/demo-machine`
- `D:/Visual Studio Projects/manual-qa-machine`
- `D:/Visual Studio Projects/prompt-language`

Override these with the environment variables listed in `.env.example` if the repos live elsewhere.

## Safety posture

- All publish and send actions must target the committed fake systems in `fixtures/`.
- Any future live dispatch path must be added as a new experiment slice with explicit approval rules.

## Running The Experiment

From the VAOP worktree:

```powershell
$env:MICRO_SAAS_MODEL_PROVIDER='openai'
node node_modules/tsx/dist/cli.mjs experiments/micro-saas-agent-stack/run.mjs
```

For OpenRouter-backed runs, set `MICRO_SAAS_MODEL_PROVIDER=openrouter` and provide
`OPENROUTER_API_KEY`.

## Browser Verification

- `manual-qa-machine` is attempted first as the preferred independent verifier.
- If `agent-browser` cannot auto-launch Chrome on this Windows host, the runner records that
  failure in `results/manual-qa.stderr.log`.
- The runner then executes a Playwright fallback and writes the black-box browser evidence under
  `results/playwright-qa/`.
