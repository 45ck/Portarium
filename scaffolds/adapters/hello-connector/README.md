# hello-connector

A minimal Level-2 (bidirectional) adapter scaffold that demonstrates the Portarium integration ladder in action.

This scaffold exercises:

- **L0** — In-memory stub (no external calls)
- **L1** — Read mapping (list / get canonical objects)
- **L2** — Write operations (create / update)

## Quick start

```bash
npm run test -- scaffolds/adapters/hello-connector/src/index.test.ts
```

## Files

| File                    | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `adapter.manifest.json` | Port-family capabilities and execution policy |
| `src/index.ts`          | Adapter implementation (stub provider)        |
| `src/index.test.ts`     | Unit tests for read + write operations        |

## Next steps

1. Replace the stub `FakeProviderClient` with a real HTTP client for your provider.
2. Update `adapter.manifest.json` with your provider slug and real egress allowlist.
3. Add your adapter to `docs/governance/domain-coverage-matrix.json` under `coverageBeads`.
4. Graduate to L3 by wiring a governed workflow in `.specify/specs/`.

## Integration ladder status

| Level          | Status    | Notes                                              |
| -------------- | --------- | -------------------------------------------------- |
| L0 — Mock      | ✅        | Stub returns shaped canonical objects              |
| L1 — Live read | ✅ (stub) | `listItems` / `getItem` mapped to canonical `Task` |
| L2 — Write     | ✅ (stub) | `createItem` / `updateItem` implemented            |
| L3 — Governed  | —         | Wire to a `.specify/specs/` workflow to graduate   |
