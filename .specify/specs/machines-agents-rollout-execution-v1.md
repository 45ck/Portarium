# Machines/Agents API Migration Rollout Execution

**ADR:** ADR-0098 (schema versioning policy)
**Bead:** bead-0802

## Purpose

Operational runbook for executing zero-downtime schema migrations for
`MachineRegistrationV1` and `AgentConfigV1` payloads. Follows the
expand/contract pattern defined in ADR-0098.

This spec is authoritative for rollout execution. It does NOT redefine
the versioning contract (see ADR-0098 and
`machines-agents-schema-versioning-v1.md`).

---

## Rollout safety invariants

The following invariants MUST hold throughout any migration rollout:

1. **Parser tolerance**: v1 parsers tolerate unknown/extra fields from v2
   records (forward-compat). Verified by backward-compat tests in
   `machine-registration-v1.test.ts`.

2. **Null-to-undefined safety**: absent optional fields serialised as JSON
   `null` in JSONB (e.g., via migration tooling) are treated as absent by
   the parsers. `parseMachineAuthConfig(null)` returns `undefined`.

3. **Version rejection**: parsers MUST throw `Unsupported schemaVersion: N`
   for any unknown version. This prevents silent data corruption.

4. **Idempotency**: `saveMachineRegistration` and `saveAgentConfig` use
   `ON CONFLICT ... DO UPDATE`, so replaying a migration is safe.

5. **Tenant isolation**: all reads/writes are scoped by `(tenant_id, ...)`.
   No cross-tenant data access during migration.

---

## Expand/contract migration phases

### Phase 1 — Expand (backward-compatible deployment)

Prerequisite: all nodes run the expand-phase code before this phase is
declared complete.

Steps:

1. Author the v2 schema: add new optional fields with sensible defaults to
   `MachineRegistrationV1` / `AgentConfigV1` types in
   `src/domain/machines/machine-registration-v1.ts`.

2. Update parsers to accept **both** v1 and v2:

   ```typescript
   if (schemaVersion !== 1 && schemaVersion !== 2) {
     throw new MachineRegistrationParseError(`Unsupported schemaVersion: ${schemaVersion}`);
   }
   ```

3. Add DB migration (numbered as next after `0014`) using
   `src/infrastructure/migrations/`. Add nullable columns for any new DB
   projections. Do NOT make columns NOT NULL yet.

4. Verify: `npm run ci:pr` passes. No existing records need changes.

5. Deploy to production. Both v1 and v2 records can now coexist.

### Phase 2 — Data migration

Prerequisites: expand-phase deployment is live and stable.

Steps:

1. Write a batch migration job or SQL update that rewrites all v1 payloads
   to v2 format (set `schemaVersion: 2`, populate new fields with defaults).

   ```sql
   UPDATE machine_registrations
      SET payload = jsonb_set(
            jsonb_set(payload, '{schemaVersion}', '2'::jsonb),
            '{healthCheckUrl}', 'null'::jsonb
          ),
          updated_at = NOW()
    WHERE (payload->>'schemaVersion')::int = 1;
   ```

2. Run the job against a staging environment first, verify all records
   parse cleanly with the v2 parser.

3. Monitor parse error rates (logs) during and after migration.

4. On success: all records in production now have `schemaVersion: 2`.

### Phase 3 — Contract (remove v1 support)

Prerequisites: zero v1 records remain in the database (verified by query).

1. Update parsers to reject v1:

   ```typescript
   if (schemaVersion !== 2) {
     throw new MachineRegistrationParseError(`Unsupported schemaVersion: ${schemaVersion}`);
   }
   ```

2. Add DB migration to make new columns NOT NULL if applicable, and drop
   columns no longer needed.

3. Remove expand-phase multi-version handling from parsers.

4. `npm run ci:pr` passes. Deploy.

---

## Rollback procedures

### Roll back Expand phase

If the expand-phase deployment causes issues:

1. Revert to the previous deployment (no DB changes needed — new columns
   are nullable so old code ignores them).

2. The data migration has not run yet, so all records remain v1.

### Roll back Data migration

If the migration job corrupts records:

1. Restore from the pre-migration DB snapshot.

   Or, if partial migration occurred and snapshots are unavailable, revert
   records with:

   ```sql
   UPDATE machine_registrations
      SET payload = jsonb_set(payload, '{schemaVersion}', '1'::jsonb),
          updated_at = NOW()
    WHERE (payload->>'schemaVersion')::int = 2;
   ```

   (Adjust field removal/reversion as needed for specific v2 additions.)

2. Redeploy the expand-phase code (supports both v1 and v2) to cover any
   partially migrated records.

### Roll back Contract phase

If v1 records resurface (e.g., old code path re-inserted a v1 record):

1. Redeploy the expand-phase code that accepts both versions.

2. Investigate the source of new v1 records and fix before re-attempting
   the contract phase.

---

## Pre-rollout checklist

Before executing any phase:

- [ ] `npm run ci:pr` passes on the feature branch.
- [ ] Backward-compat tests pass (`machine-registration-v1.test.ts`
      backward-compat invariants suite).
- [ ] DB migration scripts reviewed and tested against a staging snapshot.
- [ ] Rollback procedure documented and tested.
- [ ] Parse error monitoring is in place (alert on `ParseError` log lines).
- [ ] All nodes in the cluster are on the same expand-phase binary before
      data migration begins.

---

## Current schema versions

| Type                  | schemaVersion | Introduced | Status |
| --------------------- | ------------- | ---------- | ------ |
| MachineRegistrationV1 | 1             | bead-0787  | Active |
| AgentConfigV1         | 1             | bead-0787  | Active |

v2 schemas are not yet defined. This runbook is in place so the expand
phase can proceed without additional planning overhead when the integration
campaign (bead-0784) requires schema evolution.
