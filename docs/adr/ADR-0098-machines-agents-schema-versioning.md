# ADR-0098 — Machines/agents schema versioning and v1→v2 migration policy

**Status:** Accepted
**Date:** 2026-02-23
**Bead:** bead-0787

---

## Context

The Portarium machine-agent subsystem stores two versioned payloads in the
database:

- **MachineRegistrationV1** (`machine_registrations.payload`) — describes an
  OpenClaw-connected machine (endpoint URL, capabilities, execution policy,
  optional auth config).
- **AgentConfigV1** (`agent_configs.payload`) — describes an agent bound to a
  machine (capabilities, policyTier, allowedTools).

Each payload carries an integer `schemaVersion` field so parsers can hard-reject
payloads written by an incompatible version of the control plane. As the schema
evolves, a clear versioning contract is required to:

1. Protect existing data from silent corruption.
2. Enable zero-downtime migrations between schema versions.
3. Give operators a predictable upgrade path.

The parsers today reject any `schemaVersion` other than `1`:

```typescript
if (schemaVersion !== 1) {
  throw new AgentConfigParseError(`Unsupported schemaVersion: ${schemaVersion}`);
}
```

No v2 schema exists yet, but the integration campaign (bead-0784) will likely
require extending both schemas. This ADR defines the rules before that work
begins.

---

## Decision

### 1. Version contract

| Rule                      | Detail                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Additive changes          | May be added to v1 via optional fields with backwards-compatible defaults. No schemaVersion bump.                            |
| Breaking changes          | Require a schemaVersion bump (v1 → v2). Breaking = removing a field, narrowing a type, or changing semantics.                |
| Multi-version coexistence | During migration, parsers MUST support both the old and new schemaVersion simultaneously.                                    |
| Version sunset            | A schemaVersion is retired only after all records in the database have been migrated and a contract-phase migration has run. |

### 2. Current v1 schema (baseline)

**MachineRegistrationV1** (schemaVersion 1):

```
schemaVersion: 1
machineId: MachineId
workspaceId: WorkspaceId
endpointUrl: string           // HTTPS URL of the machine runtime
active: boolean
displayName: string
capabilities: CapabilityDescriptorV1[]  // non-empty
registeredAtIso: string
executionPolicy:
  isolationMode: "PerTenantWorker"
  egressAllowlist: string[]   // non-empty HTTPS URLs
  workloadIdentity: "Required"
authConfig?: (optional)
  kind: "bearer" | "apiKey" | "mtls" | "none"
  secretRef?: string
```

**AgentConfigV1** (schemaVersion 1):

```
schemaVersion: 1
agentId: AgentId
workspaceId: WorkspaceId
machineId: MachineId
displayName: string
capabilities: CapabilityDescriptorV1[]  // non-empty
policyTier: "Auto" | "Supervised" | "FullApproval"
allowedTools: string[]        // may be empty
registeredAtIso: string
```

### 3. Expand/contract migration pattern

Any schema version bump follows the database expand/contract pattern already
used for SQL migrations (see ADR-0096):

**Expand phase** (deployed first, backward-compatible):

- Add the new field(s) with sensible defaults.
- Parser updated to handle BOTH old and new schemaVersion.
- DB migration adds any new nullable columns.
- Old records continue to parse and function.

**Contract phase** (deployed after all records migrated):

- A data migration converts all old-version records to the new version.
- Parser updated to reject the old schemaVersion.
- DB migration drops any columns that were required only for the old version.

### 4. Planned v2 changes (not yet scheduled)

The following changes are earmarked for v2. They MUST NOT be added as additive
changes to v1 because they alter semantics or tighten constraints:

| Field                                  | Change                       | Reason                                                                                        |
| -------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| `MachineRegistrationV1.authConfig`     | Become required (remove `?`) | Security hardening — unauthenticated machines must be explicitly opted out via `kind: "none"` |
| `AgentConfigV1.updatedAtIso`           | New required field           | Enables change detection without querying the DB `updated_at` column                          |
| `AgentConfigV1.description`            | New optional field           | User-facing description for cockpit display                                                   |
| `MachineRegistrationV1.healthCheckUrl` | New optional field           | Enables gateway health polling without a separate config                                      |
| `MachineRegistrationV1.labels`         | New optional map             | Key-value metadata for fleet categorisation                                                   |

These will be implemented as a batch when the first breaking need arises,
not individually, to minimise the dual-version window.

### 5. Parser enforcement

Parsers MUST hard-reject unknown schemaVersions. The current pattern is correct
and MUST be preserved in any updated parsers:

```typescript
const schemaVersion = readInteger(record, 'schemaVersion', ParseError);
if (schemaVersion !== 1) {
  throw new ParseError(`Unsupported schemaVersion: ${schemaVersion}`);
}
```

Once v2 is introduced, the guard becomes:

```typescript
if (schemaVersion === 1) return parseMachineRegistrationV1Fields(record);
if (schemaVersion === 2) return parseMachineRegistrationV2Fields(record);
throw new ParseError(`Unsupported schemaVersion: ${schemaVersion}`);
```

### 6. Database storage

The `schemaVersion` integer is stored inside the `payload JSONB` column, not as
a separate column. This means the DB can hold mixed-version rows during the
expand phase without schema changes. No additional DB migration is needed
solely to support versioning.

### 7. Contract test coverage

The `application-command-query-schema.golden.json` contract file locks the
TypeScript type shape via SHA-256. Any schema change that alters a type alias
breaks the golden file CI gate and requires deliberate regeneration.

Parsers that accept a new schemaVersion must have boundary tests covering:

- Valid v1 parsing (regression).
- Valid v2 parsing (new schema).
- Rejection of an unknown version (e.g., `schemaVersion: 99`).

---

## Consequences

### Positive

- Operators can trust that a `schemaVersion` mismatch will never silently corrupt data.
- Zero-downtime upgrades are possible via the expand/contract pattern.
- The v2 roadmap is documented before implementation begins, preventing ad-hoc drift.

### Negative / trade-offs

- The expand phase requires parsers to temporarily maintain dual-version logic.
- Schema evolution must be batched (prefer one v2 bump over many) to minimise the dual-version window.

### Neutral

- The DB `payload JSONB` approach means no SQL migration is needed to support versioning itself, only for any new columns introduced by v2 features.
