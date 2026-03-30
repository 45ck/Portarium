# Tier B Schema-Per-Tenant Multi-Tenancy

**ADR**: 0049
**Bead**: 0947

## Overview

Tier B provides schema-per-tenant isolation within a shared PostgreSQL database. Each tenant gets a dedicated schema (`tenant_<id>`) containing its own set of tables, while sharing the same database connection pool.

## Behaviour

### Provisioning
- `TenantSchemaManager.provisionTenantSchema(tenantId)` creates a Postgres schema and runs migrations inside it.
- Provisioning is idempotent: re-calling with the same tenant returns the existing config.
- The schema name is derived from the tenant ID: `tenant_<sanitized_id>`.

### Connection Routing
- `TenantConnectionRouter.getClientForTenant(tenantId)` returns a SqlClient scoped to the tenant's tier.
- Tier A tenants receive the shared client (no search_path change).
- Tier B tenants receive a SchemaScopedSqlClient that sets `search_path` before each query.
- Tier C tenants receive a dedicated database connection from the client factory.

### TENANCY_TIER Env Var
- `TENANCY_TIER=A` forces all tenants to Tier A (override, for rollback).
- `TENANCY_TIER=B` sets default tier for new provisioning to Tier B.
- Unset: tier is determined by the tenant_storage_tiers registry table.

### Tier A to Tier B Migration
- `migrateTenantTierAToB(options)` copies data from shared tables to the tenant schema.
- Runs within a transaction for consistency.
- Optionally deletes source rows from shared tables after copy.
- Tables migrated: domain_documents, workspace_summary, workflow_runs.

### Safety
- `dropTenantSchema` is blocked in production environments.
- Schema names are sanitized to prevent SQL injection (only lowercase alphanumeric + underscore).

## Invariants

- A Tier B tenant's queries never read or write to the shared public schema tables.
- The shared client remains available for Tier A tenants — backward compatible.
- Schema migration journal tracks per-tenant migration state independently.
