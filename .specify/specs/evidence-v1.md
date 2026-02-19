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

Privacy minimisation invariants for immutable metadata:

- `summary` MUST NOT include direct personal identifiers (for example, email addresses).
- `links.externalRefs[].externalId` MUST be opaque identifiers, not raw PII values.
- `payloadRefs[].uri` MUST NOT contain query strings or fragments.

### EvidencePayloadRef

- `kind`: `Artifact | Snapshot | Diff | Log`
- `uri`: storage URI/path (implementation-specific)
- `contentType?`: MIME type
- `sha256?`: optional content hash of the referenced payload

## Hashing and Canonicalization

`hashSha256` is computed as SHA-256 hex over a canonical JSON encoding of the entry **excluding** `hashSha256` itself.

Canonical JSON is aligned to **RFC 8785 JCS** (JSON Canonicalization Scheme,
<https://www.rfc-editor.org/rfc/rfc8785>) for deterministic cross-language verification.

Rules:

- Object keys are sorted by **Unicode code point order** (equivalent to JS `<`/`>` for
  all BMP characters; domain key names are ASCII so byte order applies).
- `undefined` fields are omitted.
- Arrays preserve insertion order.
- Numbers are serialized using the shortest round-trip form (ECMAScript `Number::toString`,
  equivalent to IEEE 754 binary-to-decimal via Ryū/Grisu — JCS §3.2.2.3).
- Non-finite numbers (`NaN`, `Infinity`) are rejected.
- Only JSON-compatible values are accepted (no `Date`, `Map`, class instances, `BigInt`,
  `Symbol`, or functions).

Implementation: `src/domain/evidence/canonical-json.ts` — `canonicalizeJson()`.

Cross-language verification: any RFC 8785 JCS-compliant implementation will produce a
byte-identical output for the same input, enabling hash chain verification in Python,
Java, Go, or other runtimes without a TypeScript dependency.

Chain rule:

- For entry `i > 0`, `entries[i].previousHash` must equal `entries[i-1].hashSha256`.

## Verification

Verification (`verifyEvidenceChainV1`) must detect:

- Any content modification to an entry (hash mismatch — `hash_mismatch`)
- Any re-ordering, insertion, or deletion (previousHash chain break — `chain_break`)
- Out-of-order timestamps (`entries[i].occurredAtIso < entries[i-1].occurredAtIso` — `timestamp_not_monotonic`)
