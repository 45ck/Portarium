# Software-First Autonomy Multi-Project Showcase

Status: recording-ready example for `bead-1104`.

This showcase demonstrates two governed Project types without making equal
production claims:

- `Micro-SaaS builder alpha` is the primary `self-use` Project.
- `Content artifact studio` is a secondary `demo-only` Project.

The recording storyline covers mobile approval with an exception, desktop
Project switching, policy review, Evidence Log review, and a human intervention
that narrows the next Run instead of allowing unsupervised continuation.

## Run Locally

```powershell
npx --yes http-server examples/showcase/software-first-autonomy -p 4184
```

Open `http://localhost:4184`.

## Demo-Machine Specs

- `software-first-autonomy.mobile.demo.yaml`
- `software-first-autonomy.desktop.demo.yaml`

Both specs enable narration focus defaults:

- cursor enabled
- zoom enabled
- scale `1.25`
- focus duration `1600ms`
- transition `450ms`

Suggested render output directory:

```powershell
qa-artifacts/software-first-autonomy-showcase
```

## Validation

```powershell
node node_modules/vitest/vitest.mjs run src/presentation/ops-cockpit/software-first-autonomy-showcase.test.ts
node node_modules/prettier/bin/prettier.cjs --check examples/showcase/software-first-autonomy src/presentation/ops-cockpit/software-first-autonomy-showcase.test.ts
```
