# Bead-0702 Review: OpenAPI SDK Generation and Publish

## Scope

- Generate SDK artifacts for TypeScript and Python from the OpenAPI contract.
- Add CI/release automation to publish SDK outputs.

## Changes

- Added release/CI workflow:
  - `.github/workflows/openapi-sdks.yml`
- Added TypeScript SDK packaging script:
  - `scripts/codegen/package-ts-sdk.mjs`
- Extended npm scripts for TS/Python codegen orchestration:
  - `package.json`
- Added SDK publish runbook:
  - `docs/sdk/openapi-sdk-publish.md`

## Validation

- `npm run lint`
- `npm run format:check`
