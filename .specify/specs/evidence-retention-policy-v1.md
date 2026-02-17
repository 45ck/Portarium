# Evidence Retention and Disposition v1

## Purpose

Define evidence retention, legal hold, and destruction/de-identification controls for control-plane operations.

This is complementary to the `EvidenceEntryV1` schema in `evidence-v1.md` and ADRs 0028/0029.

## Retention classes

- `Operational`: low-risk operational signals (default, short duration).
- `Compliance`: evidence tied to approval outcomes, run outcomes, and policy actions.
- `Forensic`: evidence requested for incident or audit trails.

## Workspace policy

Each workspace defines default retention durations per class (minimum values can be tightened by legal/compliance overlays):

- `Operational`: 30 days
- `Compliance`: 365 days
- `Forensic`: 2555 days (7 years)

The system applies the **minimum** of policy and workspace override.

## Legal hold

Legal hold takes precedence over normal disposition:

- While a hold is active, payloads and metadata for matched entries must remain discoverable and undisposed.
- Active hold metadata should include:
  - `holdId`
  - `reason`
  - `appliedByUserId`
  - `appliedAtIso`
  - optional `expiresAtIso`
  - legal basis (`compliance`, `litigation`, `security`, etc.)

Release from hold transitions entries back to normal disposition scheduling.

## Disposition workflow

Disposition is a two-step process:

1. **Mark due**: entry/payload crosses retention cutoff and is not under legal hold.
2. **Apply disposition**:
   - destroy raw payload references where retention allows, and
   - keep hash-chained metadata immutable.

When destruction is not permitted by policy, entries move to **de-identify** workflow:

- redact/re-hash sensitive fields,
- preserve audit metadata for integrity checks,
- record disposition outcome in an evidence entry event.

## Audit requirements

- Every disposition or de-identification action emits an evidence entry.
- All legal-hold transitions are immutable and include actor + rationale.
- Retention policy evaluation must be reproducible from stored policy versioning.
