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
  {
    version: 6,
    id: '0006_expand_workflow_runs_projection_columns',
    description:
      'Adds workspace_id, workflow_id, initiated_by_user_id, started_at, ended_at, and event_seq ' +
      'columns to workflow_runs to support full read-model projection (bead-0315).',
    phase: 'Expand',
    scope: 'Tenant',
    compatibility: 'BackwardCompatible',
    upSql: [
      'ALTER TABLE IF EXISTS workflow_runs ADD COLUMN IF NOT EXISTS workspace_id TEXT NULL;',
      'ALTER TABLE IF EXISTS workflow_runs ADD COLUMN IF NOT EXISTS workflow_id TEXT NULL;',
      'ALTER TABLE IF EXISTS workflow_runs ADD COLUMN IF NOT EXISTS initiated_by_user_id TEXT NULL;',
      'ALTER TABLE IF EXISTS workflow_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL;',
      'ALTER TABLE IF EXISTS workflow_runs ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ NULL;',
      'ALTER TABLE IF EXISTS workflow_runs ADD COLUMN IF NOT EXISTS event_seq BIGINT NOT NULL DEFAULT 0;',
      'CREATE INDEX IF NOT EXISTS idx_workflow_runs_workspace ON workflow_runs (tenant_id, workspace_id);',
    ],
    downSql: [
      'DROP INDEX IF EXISTS idx_workflow_runs_workspace;',
      'ALTER TABLE IF EXISTS workflow_runs DROP COLUMN IF EXISTS event_seq;',
      'ALTER TABLE IF EXISTS workflow_runs DROP COLUMN IF EXISTS ended_at;',
      'ALTER TABLE IF EXISTS workflow_runs DROP COLUMN IF EXISTS started_at;',
      'ALTER TABLE IF EXISTS workflow_runs DROP COLUMN IF EXISTS initiated_by_user_id;',
      'ALTER TABLE IF EXISTS workflow_runs DROP COLUMN IF EXISTS workflow_id;',
      'ALTER TABLE IF EXISTS workflow_runs DROP COLUMN IF EXISTS workspace_id;',
    ],
  },
  {
    version: 7,
    id: '0007_expand_workspace_summary_table',
    description:
      'Creates workspace_summary denormalized read table for workspace query projections (bead-0315).',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: [
      `CREATE TABLE IF NOT EXISTS workspace_summary (
  tenant_id    TEXT        NOT NULL,
  workspace_id TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  status       TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,
  event_seq    BIGINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, workspace_id)
);`,
      'CREATE INDEX IF NOT EXISTS idx_workspace_summary_status ON workspace_summary (tenant_id, status);',
      'CREATE INDEX IF NOT EXISTS idx_workspace_summary_name ON workspace_summary (tenant_id, name text_pattern_ops);',
    ],
    downSql: [
      'DROP INDEX IF EXISTS idx_workspace_summary_name;',
      'DROP INDEX IF EXISTS idx_workspace_summary_status;',
      'DROP TABLE IF EXISTS workspace_summary;',
    ],
  },
  {
    version: 8,
    id: '0008_expand_tenant_storage_tiers_table',
    description:
      'Creates tenant_storage_tiers registry for ADR-0049 Tier B/C storage provisioning.',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: [
      `CREATE TABLE IF NOT EXISTS tenant_storage_tiers (
  tenant_id         TEXT        NOT NULL PRIMARY KEY,
  tier              TEXT        NOT NULL,
  schema_name       TEXT        NULL,
  connection_string TEXT        NULL,
  provisioned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,
    ],
    downSql: ['DROP TABLE IF EXISTS tenant_storage_tiers;'],
  },
  {
    version: 9,
    id: '0009_expand_data_layer_indexes',
    description:
      'Adds missing B-tree indexes on hot-path WHERE/ORDER BY columns in workflow_runs, ' +
      'domain_documents, and workspace_summary (bead-nj7i).',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: [
      // domain_documents: (tenant_id, collection) is the most common scan path
      'CREATE INDEX IF NOT EXISTS idx_domain_documents_collection ON domain_documents (tenant_id, collection);',
      // domain_documents: order/filter by most-recently updated
      'CREATE INDEX IF NOT EXISTS idx_domain_documents_updated_at ON domain_documents (tenant_id, collection, updated_at DESC);',
      // workflow_runs: filter by workflow_id
      'CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs (tenant_id, workflow_id) WHERE workflow_id IS NOT NULL;',
      // workflow_runs: filter by initiating user
      'CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id ON workflow_runs (tenant_id, initiated_by_user_id) WHERE initiated_by_user_id IS NOT NULL;',
      // workflow_runs: order by created_at for time-based list queries
      'CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at ON workflow_runs (tenant_id, created_at DESC);',
      // workspace_summary: order by created_at
      'CREATE INDEX IF NOT EXISTS idx_workspace_summary_created_at ON workspace_summary (tenant_id, created_at DESC);',
    ],
    downSql: [
      'DROP INDEX IF EXISTS idx_workspace_summary_created_at;',
      'DROP INDEX IF EXISTS idx_workflow_runs_created_at;',
      'DROP INDEX IF EXISTS idx_workflow_runs_user_id;',
      'DROP INDEX IF EXISTS idx_workflow_runs_workflow_id;',
      'DROP INDEX IF EXISTS idx_domain_documents_updated_at;',
      'DROP INDEX IF EXISTS idx_domain_documents_collection;',
    ],
  },
  {
    version: 10,
    id: '0010_expand_data_layer_fk_constraints',
    description:
      'Adds FK constraints from workflow_runs, workspace_summary, and domain_documents ' +
      'to workspace_registry with ON DELETE CASCADE (bead-nj7i). Constraints are added ' +
      'NOT VALID to avoid blocking on existing data; run VALIDATE CONSTRAINT separately ' +
      'for zero-downtime backfill verification.',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: [
      'ALTER TABLE workflow_runs ADD CONSTRAINT fk_workflow_runs_tenant FOREIGN KEY (tenant_id) REFERENCES workspace_registry (tenant_id) ON DELETE CASCADE NOT VALID;',
      'ALTER TABLE workspace_summary ADD CONSTRAINT fk_workspace_summary_tenant FOREIGN KEY (tenant_id) REFERENCES workspace_registry (tenant_id) ON DELETE CASCADE NOT VALID;',
      'ALTER TABLE domain_documents ADD CONSTRAINT fk_domain_documents_tenant FOREIGN KEY (tenant_id) REFERENCES workspace_registry (tenant_id) ON DELETE CASCADE NOT VALID;',
    ],
    downSql: [
      'ALTER TABLE domain_documents DROP CONSTRAINT IF EXISTS fk_domain_documents_tenant;',
      'ALTER TABLE workspace_summary DROP CONSTRAINT IF EXISTS fk_workspace_summary_tenant;',
      'ALTER TABLE workflow_runs DROP CONSTRAINT IF EXISTS fk_workflow_runs_tenant;',
    ],
  },
  {
    version: 11,
    id: '0011_expand_derived_artifacts_table',
    description:
      'Creates derived_artifacts registry table for computed artefacts (embeddings, graph nodes, ' +
      'chunk indexes) produced by the projection worker (bead-0772).',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: [
      `CREATE TABLE IF NOT EXISTS derived_artifacts (
  tenant_id         TEXT        NOT NULL,
  workspace_id      TEXT        NOT NULL,
  artifact_id       TEXT        NOT NULL,
  kind              TEXT        NOT NULL,
  run_id            TEXT        NOT NULL,
  evidence_id       TEXT        NULL,
  projector_version TEXT        NOT NULL,
  retention_policy  TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, workspace_id, artifact_id)
);`,
      'CREATE INDEX IF NOT EXISTS idx_derived_artifacts_run ON derived_artifacts (tenant_id, workspace_id, run_id);',
      'CREATE INDEX IF NOT EXISTS idx_derived_artifacts_expires ON derived_artifacts (expires_at) WHERE expires_at IS NOT NULL;',
    ],
    downSql: [
      'DROP INDEX IF EXISTS idx_derived_artifacts_expires;',
      'DROP INDEX IF EXISTS idx_derived_artifacts_run;',
      'DROP TABLE IF EXISTS derived_artifacts;',
    ],
  },
  {
    version: 12,
    id: '0012_expand_projection_checkpoints_table',
    description:
      'Creates projection_checkpoints table for at-least-once delivery tracking by the ' +
      'derived-artifact projection worker (bead-0772).',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: [
      `CREATE TABLE IF NOT EXISTS projection_checkpoints (
  tenant_id                   TEXT        NOT NULL,
  workspace_id                TEXT        NOT NULL,
  run_id                      TEXT        NOT NULL,
  last_processed_evidence_id  TEXT        NOT NULL,
  last_processed_at           TIMESTAMPTZ NOT NULL,
  projector_version           TEXT        NOT NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, workspace_id, run_id)
);`,
    ],
    downSql: ['DROP TABLE IF EXISTS projection_checkpoints;'],
  },
  {
    version: 13,
    id: '0013_expand_machine_registrations_table',
    description:
      'Creates machine_registrations table for persistent OpenClaw gateway registration ' +
      'and live heartbeat tracking (bead-0791).',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: [
      `CREATE TABLE IF NOT EXISTS machine_registrations (
  tenant_id          TEXT        NOT NULL,
  machine_id         TEXT        NOT NULL,
  workspace_id       TEXT        NOT NULL,
  payload            JSONB       NOT NULL,
  heartbeat_status   TEXT        NULL,
  heartbeat_at       TIMESTAMPTZ NULL,
  heartbeat_metrics  JSONB       NULL,
  heartbeat_location JSONB       NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, machine_id)
);`,
      'CREATE INDEX IF NOT EXISTS idx_machine_registrations_workspace ON machine_registrations (tenant_id, workspace_id);',
    ],
    downSql: [
      'DROP INDEX IF EXISTS idx_machine_registrations_workspace;',
      'DROP TABLE IF EXISTS machine_registrations;',
    ],
  },
  {
    version: 14,
    id: '0014_expand_agent_configs_table',
    description:
      'Creates agent_configs table for persistent OpenClaw agent configuration ' +
      'and heartbeat tracking (bead-0791).',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: [
      `CREATE TABLE IF NOT EXISTS agent_configs (
  tenant_id        TEXT        NOT NULL,
  agent_id         TEXT        NOT NULL,
  machine_id       TEXT        NOT NULL,
  workspace_id     TEXT        NOT NULL,
  payload          JSONB       NOT NULL,
  heartbeat_status TEXT        NULL,
  heartbeat_at     TIMESTAMPTZ NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, agent_id)
);`,
      'CREATE INDEX IF NOT EXISTS idx_agent_configs_machine ON agent_configs (tenant_id, machine_id);',
      'CREATE INDEX IF NOT EXISTS idx_agent_configs_workspace ON agent_configs (tenant_id, workspace_id);',
    ],
    downSql: [
      'DROP INDEX IF EXISTS idx_agent_configs_workspace;',
      'DROP INDEX IF EXISTS idx_agent_configs_machine;',
      'DROP TABLE IF EXISTS agent_configs;',
    ],
  },
];
