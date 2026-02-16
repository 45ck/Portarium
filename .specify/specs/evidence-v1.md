# Evidence v1 (Append-Only, Tamper-Evident)

## Purpose

Evidence is the audit backbone of Portarium. It provides a verifiable, append-only timeline of what happened during Runs.

This implements:

- ADR-0028: evidence lifecycle (immutable metadata + retention-managed payloads)
- ADR-0029: tamper-evident controls (hash chaining)

## Two-Tier Evidence Model

1. **Immutable metadata events**
   - Append-only.
   - Minimised for PII.
   - Hash-chained for tamper detection.
2. **Retention-managed payloads**
   - Artifacts/snapshots/diffs/log payloads referenced from metadata.
   - Subject to tenant retention schedules, legal holds, and disposition workflows (destroy/de-identify).

## Schema (EvidenceEntryV1)

Fields:

- `schemaVersion`: `1`
- `evidenceId`: branded `EvidenceId`
- `workspaceId`: branded `WorkspaceId`
- `occurredAtIso`: ISO-8601/RFC3339 UTC timestamp string
- `category`: `Plan | Action | Approval | Policy | System`
- `summary`: human-readable one-line description
- `actor`: discriminated union of `User | Machine | Adapter | System`
- `links?`: optional cross-object links
  - `runId?`: branded `RunId`
  - `planId?`: branded `PlanId`
  - `workItemId?`: branded `WorkItemId`
  - `externalRefs?`: `ExternalObjectRef[]`
- `payloadRefs?`: retention-managed payload references
- `previousHash?`: hash of the previous evidence entry (genesis has none)
- `hashSha256`: SHA-256 hex digest of the canonicalized entry content (see below)

### EvidencePayloadRef

- `kind`: `Artifact | Snapshot | Diff | Log`
- `uri`: storage URI/path (implementation-specific)
- `contentType?`: MIME type
- `sha256?`: optional content hash of the referenced payload

## Hashing and Canonicalization

`hashSha256` is computed as SHA-256 hex over a canonical JSON encoding of the entry **excluding** `hashSha256` itself.

Canonical JSON rules:

- Object keys are sorted lexicographically (recursive).
- `undefined` fields are omitted.
- Arrays preserve order.
- Only JSON-compatible values are allowed (no `Date`, `Map`, `NaN`, `Infinity`, functions, etc).

Chain rule:

- For entry `i > 0`, `entries[i].previousHash` must equal `entries[i-1].hashSha256`.

## Verification

Verification must detect:

- Any content modification to an entry (hash mismatch)
- Any re-ordering, insertion, or deletion (previousHash mismatch)
