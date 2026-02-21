# OpenAPI SDK Generation and Publish

**Bead:** bead-0702

Portarium treats the OpenAPI contract as the source of truth for generated SDKs.

## Local generation

```bash
npm run codegen:sdk
npm run codegen:sdk:package:ts
bash ./scripts/codegen/generate-python-client.sh
```

This produces:

- TypeScript package scaffold: `sdks/typescript/portarium-openapi-client/`
- Python client package: `sdks/python/portarium-client/`

## CI workflow

Workflow: `.github/workflows/openapi-sdks.yml`

- On PR/push touching OpenAPI or codegen files:
  - Regenerates TypeScript and Python SDKs
  - Builds publishable artifacts (`.tgz`, wheel, source distribution)
  - Uploads artifacts for review/download
- On release publish:
  - Regenerates both SDKs from current OpenAPI contract
  - Publishes TypeScript SDK to npm when `NPM_TOKEN` is set
  - Publishes Python SDK to PyPI when the PyPI token secret is set

## Required release secrets

- `NPM_TOKEN`: token for publishing `@portarium/openapi-client`
- PyPI token secret: token for publishing `portarium-client`
