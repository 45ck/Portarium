# OpenClaw Adapter Surface v1

## Purpose

Define the generic Portarium contract for OpenClaw-style runtime adapters. The
contract lets downstream deployments add customer-specific aliases and policies
without weakening Portarium's governance loop.

## Scope

This spec applies to adapter manifests, bridge tools, approval-card drafting,
executor gates, evidence/result timelines, and Cockpit visibility for
OpenClaw-style integrations.

It does not define any customer-specific standing-read source, hostname, secret,
approval token, or hosted deployment topology.

## Required Contract Artifact

A machine-readable contract example must exist at:

`examples/openclaw/portarium-openclaw-adapter.contract.json`

The contract must validate with:

```bash
npm run ci:openclaw-adapter-contract
```

## Tool Alias Manifest

1. Each chat-facing tool must have a stable lower-case snake_case alias.
2. Each alias must map to one stable bridge tool name.
3. Alias values and bridge tool names must be unique.
4. Chat-facing aliases must not execute side effects.
5. The executor alias must not be chat-exposed.

## Bridge Principal Model

The contract must define these principals:

| Principal           | Authority                                                  |
| ------------------- | ---------------------------------------------------------- |
| `read-only`         | Status, inventory, health, capability, and evidence reads. |
| `standing-read`     | Bounded redacted reads under an existing scope.            |
| `approval-drafting` | Proposal and Cockpit card drafting only.                   |
| `executor`          | Direct execution gate only.                                |

Unknown principals must deny or fail closed. Only the executor principal may be
marked executable.

## Approval-Card Draft Flow

The approval-card draft tool must:

1. run under the `approval-drafting` principal,
2. be chat-exposed only as a proposal surface,
3. set `mayExecute=false`,
4. require Cockpit visibility,
5. create a review artifact rather than an approval, and
6. preserve exact scope, policy decision, evidence, risk, authority, expiry, and
   rollback or handoff information.

## Executor Gate

The executor gate must:

1. run under the `executor` principal,
2. be direct-only,
3. set `chatExposed=false`,
4. default to dry-run,
5. require explicit `execute=true` for non-dry-run execution,
6. require approval-token validation for mutations or sensitive reads, and
7. fail closed for unknown tools, unknown actions, stale cards, changed cards,
   missing scope, and missing evidence correlation.

## Evidence And Result Timeline

The adapter must preserve a correlated timeline containing:

1. proposal,
2. policy decision,
3. approval card drafted,
4. Cockpit visible,
5. approval decision,
6. execution result, and
7. evidence recorded.

The timeline must record a correlation identifier. Blocked, denied, stale,
timed-out, dry-run, and executed outcomes are all valid result states and must
remain visible.

## Cockpit Visibility

Cockpit must show:

- approval status
- Plan
- policy decision
- Evidence
- execution result
- blocked reason

Blocked work must not be hidden because it failed before execution.

## Validation Expectations

The CI validator must fail when:

- the contract file is missing or invalid JSON,
- a required principal is missing,
- a non-executor principal is executable,
- an executor alias is exposed to chat,
- an executor alias does not default to dry-run,
- approval-card drafting can execute,
- required evidence timeline events are missing, or
- Cockpit visibility omits blocked or execution-result states.

## Reference Implementation

- `examples/openclaw/portarium-openclaw-adapter.contract.json`
- `scripts/ci/check-openclaw-adapter-contract.mjs`
- `docs/integration/openclaw-adapter-contract.md`
