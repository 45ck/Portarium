# OpenClaw Full Integration Release Gate — Spec v1

**Bead:** bead-0803
**Status:** active

## Purpose

Define the release gate contract for the OpenClaw full integration milestone. All
checks in this spec must be satisfied before the integration is considered
production-ready.

## Gate Document Requirements

A release gate document MUST exist at `docs/internal/governance/openclaw-release-gate.md` and:

- Be tagged with `bead-0803`
- Document exactly six mandatory controls (see below)
- Contain a "Release Gate Criteria" section listing the pass conditions for each
  control
- Contain a "Rollback Triggers" section naming specific conditions that trigger an
  automatic rollback
- List required artifacts with their resolved file paths

## Six Mandatory Controls

### Control 1 — Multi-Tenant Isolation (ADR-0072)

All commands that side-effect workspace resources MUST verify `workspaceId` matches
`ctx.tenantId` before execution. The gate document must reference ADR-0072 and the
workspace isolation spec.

### Control 2 — Tool Blast-Radius Policy Gating

Tools dispatched through OpenClaw MUST be classified as Dangerous / Mutation /
ReadOnly / Unknown before invocation. Execution tier must meet the minimum tier for
the class or the invocation fails closed with `PolicyBlocked`. The gate document must
reference the blast-radius classifier and policy.

### Control 3 — Credential and Token Handling (ADR-0099)

Gateway bearer tokens MUST NOT be persisted to the database and MUST NOT appear in
any API response exposed to browser clients. The gate document must reference ADR-0099
and the `toMachineApiView` stripping contract.

### Control 4 — Contract Test Coverage

HTTP contract tests, integration tests, and domain unit tests covering all six
controls MUST exist and pass. The gate document must list the canonical test files.

### Control 5 — Rollback Procedure

A rollback runbook MUST exist at `docs/internal/governance/openclaw-rollback-runbook.md`.
The gate document must reference it and name rollback triggers.

### Control 6 — Monitoring and Observability

All gateway operations MUST emit structured logs with `tenantId`, `runId`, and
`correlationId`. Drift sync failures MUST surface as `BridgeOperationResult` with a
non-empty reason string. The gate document must reference the drift sync pipeline.

## Rollback Runbook Requirements

The rollback runbook MUST:

- Identify the scope of a rollback (feature-flag disable, endpoint removal, or
  config change)
- List step-by-step recovery actions for each rollback trigger type
- Define acceptance criteria that confirm rollback completion
- Reference the provisioning runbook for re-provisioning after rollback

## Artifact Existence

All of the following MUST exist at the paths listed:

| Artifact                     | Path                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Gateway machine invoker      | `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.ts`             |
| Management bridge            | `src/infrastructure/openclaw/openclaw-management-bridge.ts`                   |
| Tool blast-radius classifier | `src/domain/machines/openclaw-tool-blast-radius-v1.ts`                        |
| Agent binding validator      | `src/domain/machines/openclaw-agent-binding-v1.ts`                            |
| Drift sync pipeline          | `src/infrastructure/openclaw/openclaw-drift-sync-pipeline.ts`                 |
| Workspace isolation spec     | `.specify/specs/openclaw-gateway-workspace-isolation-v1.md`                   |
| Blast-radius policy doc      | `docs/internal/governance/openclaw-tool-blast-radius-policy.md`               |
| Provisioning runbook         | `docs/internal/governance/openclaw-workspace-gateway-provisioning-runbook.md` |
| Rollback runbook             | `docs/internal/governance/openclaw-rollback-runbook.md`                       |
| ADR-0072                     | `docs/internal/adr/0072-openclaw-gateway-multi-tenant-isolation.md`           |
