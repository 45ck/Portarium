# Setup

Run from the Portarium repository root:

```powershell
node experiments\approval-consumer-reconciler\run.mjs
```

No services, secrets, browsers, providers, or databases are required.

The experiment writes:

- `experiments/approval-consumer-reconciler/results/outcome.json`
- `experiments/approval-consumer-reconciler/results/reconciliation-trace.json`

`results/` is ignored except for `.gitkeep`.
