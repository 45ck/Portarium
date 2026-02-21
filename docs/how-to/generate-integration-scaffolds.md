# How-To: Generate Integration Scaffolds

Use the Portarium CLI to scaffold adapter and agent-wrapper projects.

## Prerequisite

```bash
npm install
```

## Generate an adapter scaffold

```bash
npm run cli:portarium -- generate adapter --name hubspot-adapter --provider-slug hubspot --port-family CrmSales --output scaffolds/adapters/hubspot
```

Generated files:

- `README.md`
- `adapter.manifest.json`
- `src/index.ts`
- `src/index.test.ts`

## Generate an agent-wrapper scaffold

```bash
npm run cli:portarium -- generate agent-wrapper --name openclaw-wrapper --runtime openclaw --output scaffolds/agent-wrappers/openclaw-wrapper
```

Generated files:

- `README.md`
- `agent-wrapper.manifest.json`
- `.env.example`
- `src/server.ts`

## Overwrite an existing scaffold

```bash
npm run cli:portarium -- generate adapter --name hubspot-adapter --output scaffolds/adapters/hubspot --force
```

## Next steps

1. Replace scaffold stubs with real provider or runtime calls.
2. Add contract tests against your integration target.
3. Register the adapter/machine in Portarium and run smoke tests.
