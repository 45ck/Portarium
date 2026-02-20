# @portarium/piece-projects-work-mgmt

Example TypeScript npm package pattern for a Portarium custom Activepieces piece.

## What this package shows

- Per-operation mapping from Portarium capabilities to Activepieces flow slugs.
- Correlation header propagation (`tenantId`, `correlationId`, optional `runId`).
- Family-scoped packaging pattern that can be copied to other Port Families.

## Adapt for another Port Family

1. Copy this folder and rename the package.
2. Replace `PORTARIUM_PROJECTS_WORK_MGMT_MAPPINGS` with target family mappings.
3. Keep `buildCorrelationHeaders` unchanged to preserve telemetry propagation contract.
