import type { SchemaMigration } from './schema-migrator.js';

export const DEFAULT_SCHEMA_MIGRATIONS: readonly SchemaMigration[] = [
  {
    version: 1,
    id: '0001_expand_runtime_schema_baseline',
    description: 'Creates baseline runtime schema and migration journal table.',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: [
      'CREATE TABLE IF NOT EXISTS schema_migrations (target TEXT NOT NULL, version INTEGER NOT NULL, migration_id TEXT NOT NULL, phase TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (target, version));',
      'CREATE TABLE IF NOT EXISTS workspace_registry (tenant_id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());',
    ],
    downSql: [
      'DROP TABLE IF EXISTS workspace_registry;',
      'DROP TABLE IF EXISTS schema_migrations;',
    ],
  },
  {
    version: 2,
    id: '0002_expand_run_projection_columns',
    description: 'Adds nullable columns required for dual-write rollout before contract cleanup.',
    phase: 'Expand',
    scope: 'Tenant',
    compatibility: 'BackwardCompatible',
    upSql: [
      'ALTER TABLE IF EXISTS workflow_runs ADD COLUMN IF NOT EXISTS status_v2 TEXT NULL;',
      'ALTER TABLE IF EXISTS workflow_runs ADD COLUMN IF NOT EXISTS status_transitioned_at TIMESTAMPTZ NULL;',
    ],
    downSql: [
      'ALTER TABLE IF EXISTS workflow_runs DROP COLUMN IF EXISTS status_transitioned_at;',
      'ALTER TABLE IF EXISTS workflow_runs DROP COLUMN IF EXISTS status_v2;',
    ],
  },
  {
    version: 3,
    id: '0003_contract_drop_legacy_run_status',
    description: 'Drops legacy status column after expand rollout and backfill verification.',
    phase: 'Contract',
    scope: 'Tenant',
    compatibility: 'ContractBreaking',
    upSql: ['ALTER TABLE IF EXISTS workflow_runs DROP COLUMN IF EXISTS status_legacy;'],
    downSql: [
      'ALTER TABLE IF EXISTS workflow_runs ADD COLUMN IF NOT EXISTS status_legacy TEXT NULL;',
    ],
  },
  {
    version: 4,
    id: '0004_expand_domain_documents_table',
    description: 'Creates domain_documents JSONB document store table with indexes.',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: [
      `CREATE TABLE IF NOT EXISTS domain_documents (
  tenant_id    TEXT        NOT NULL,
  workspace_id TEXT        NULL,
  collection   TEXT        NOT NULL,
  document_id  TEXT        NOT NULL,
  payload      JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, collection, document_id)
);`,
      'CREATE INDEX IF NOT EXISTS idx_domain_documents_workspace ON domain_documents (tenant_id, collection, workspace_id);',
    ],
    downSql: [
      'DROP INDEX IF EXISTS idx_domain_documents_workspace;',
      'DROP TABLE IF EXISTS domain_documents;',
    ],
  },
  {
    version: 5,
    id: '0005_expand_workflow_runs_table',
    description: 'Creates workflow_runs projection table used by run query store.',
    phase: 'Expand',
    scope: 'Tenant',
    compatibility: 'BackwardCompatible',
    upSql: [
      `CREATE TABLE IF NOT EXISTS workflow_runs (
  tenant_id    TEXT        NOT NULL,
  run_id       TEXT        NOT NULL,
  status       TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, run_id)
);`,
      'CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs (tenant_id, status);',
    ],
    downSql: [
      'DROP INDEX IF EXISTS idx_workflow_runs_status;',
      'DROP TABLE IF EXISTS workflow_runs;',
    ],
  },
];
