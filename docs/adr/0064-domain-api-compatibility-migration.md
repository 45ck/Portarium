# ADR-0064: Domain API Compatibility and Migration Strategy

**Beads:** bead-0309
**Status:** Accepted
**Date:** 2026-02-18

## Context

The domain uses a `PortCapability` branded type (`"entity:verb"` string) to represent
canonical capability identifiers for each port family. Historically, adapter registrations
and workflow actions used an unbranded `operation: string` field for the same purpose.

Two overlapping representations now exist in `CapabilityClaimV1`:

```typescript
type CapabilityClaimV1 = {
  capability?: PortCapability; // canonical — validated against PORT_FAMILY_CAPABILITIES
  operation: string; // legacy — free-form entity:verb string
  requiresAuth: boolean;
};
```

Without a documented migration policy, the two fields create ambiguity:
which field is authoritative? How should consumers decide which field to read?
When can the legacy field be removed? What happens if an adapter is registered with
the old format and a new workflow tries to invoke it using the canonical type?

## Decision

### 1. Canonical-first compatibility strategy

`capability` is the authoritative field when present. `operation` is the legacy fallback.
The matching logic (implemented in `adapterClaimSupportsCapability`) follows:

```
if claim.capability is set → compare against claim.capability
else                        → compare against claim.operation
```

Parsers enforce this invariant at ingestion time:

- If `capability` is supplied, it must be a member of `PORT_FAMILY_CAPABILITIES[portFamily]`.
- If both `capability` and `operation` are supplied, they must be equal.
- If only `operation` is supplied (legacy path), it must match the `entity:verb` pattern.
- Exactly one of `capability` or `operation` must be present.

### 2. Serialization contract for rollback safety

Existing payloads that only carry `operation` continue to parse without modification.
No breaking schema change is introduced. Rollback to a previous deployment that did
not understand `capability` is safe: those versions ignore the new field entirely
because `operation` is still always written when `capability` is set (the parser
copies `capability` into `operation` automatically).

```typescript
// Parser always writes operation — old consumers can still read it
return {
  capability, // new canonical field
  operation: capability, // mirrored for backward compat
  requiresAuth,
};
```

### 3. Deprecation timeline for `operation` (legacy path)

| Phase                   | Trigger                                        | Action                                           |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------ |
| **Current (migration)** | `capability` field introduced                  | Both fields accepted; canonical preferred        |
| **Enforcement**         | All active adapter registrations migrated      | Warn on `operation`-only claims at parse time    |
| **Removal**             | Domain major version bump (`schemaVersion: 2`) | `operation` field removed; `capability` required |

Schema version gates the removal: `schemaVersion: 2` parsers may reject `operation`-only
claims. Until then, `schemaVersion: 1` parsers must accept both forms.

### 4. Workflow action migration

`WorkflowActionV1` follows the same pattern with `capability` (preferred) and `operation`
(legacy fallback). The `resolveActionCapability` helper in `capability-enforcement.ts`
encapsulates the resolution logic:

```typescript
export function resolveActionCapability(action: WorkflowActionV1): string {
  return action.capability ?? action.operation;
}
```

This allows workflow definitions stored with the old `operation` field to continue
routing correctly through the provider selection pipeline.

### 5. Cross-family operation guard

`selectProvider` validates that the requested operation is a member of
`PORT_FAMILY_CAPABILITIES[portFamily]` before any adapter lookup. This means
cross-family operation requests (e.g., `party:read` against `FinanceAccounting`)
return `operation_not_in_family` rather than `no_capable_adapter`, giving callers
a precise signal even when no adapters are registered.

## Consequences

**Positive:**

- Zero breaking changes for existing adapter registrations or workflow definitions.
- Clear, mechanically enforced migration path from `operation` to `capability`.
- `schemaVersion` field on all domain types provides a future removal gate.
- Rollback to pre-`capability` deployments is safe without data migration.

**Negative:**

- Both fields must be maintained until schema v2 — slight parser complexity.
- Consumers reading `operation` miss the family-level validation that `capability` provides.
- Removal of `operation` requires a coordinated schema version bump across all adapters.

## Alternatives Considered

- **Remove `operation` immediately** — breaks all existing adapter registrations.
- **Make `capability` the only field, rename `operation` to `legacyOperation`** —
  cleaner rename but still a breaking change for all existing payloads.
- **Accept any `entity:verb` string as `capability`** — loses the family-level
  validation that gives `operation_not_in_family` its meaning.
