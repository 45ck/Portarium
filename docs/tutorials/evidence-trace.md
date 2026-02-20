# Tutorial: Evidence Trace

## Outcome

You will complete a Human Task and view the resulting Evidence entry.

## Steps

### 1. Start control plane runtime

```bash
npx tsx src/presentation/runtime/control-plane.ts
```

### 2. Complete a Human Task (auth required)

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"completionNote":"Reviewed and approved"}' \
  http://localhost:8080/v1/workspaces/workspace-1/human-tasks/ht-1/complete
```

### 3. Query Evidence

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/v1/workspaces/workspace-1/evidence?runId=run-101"
```

## Notes

- Runtime uses fixture-backed behavior in scaffold stage.
- Evidence persistence adapters are still in progress.

## Source of truth

- `src/presentation/runtime/control-plane-handler.ts`
- `docs/adr/0029-evidence-integrity-tamper-evident.md`
