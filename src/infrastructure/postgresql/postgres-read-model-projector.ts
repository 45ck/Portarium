/**
 * PostgreSQL implementation of ReadModelProjector.
 * Upserts projection rows idempotently — safe to replay events.
 * Bead: bead-0315
 */
import type { SqlClient } from './sql-client.js';
import type {
  ReadModelProjector,
  RunProjectionEvent,
  WorkspaceProjectionEvent,
} from '../../application/ports/read-model-projector.js';

export class PostgresReadModelProjector implements ReadModelProjector {
  constructor(private readonly sql: SqlClient) {}

  async upsertRun(event: RunProjectionEvent): Promise<void> {
    await this.sql.query(
      `INSERT INTO workflow_runs
         (tenant_id, run_id, workspace_id, workflow_id, status,
          initiated_by_user_id, created_at, started_at, ended_at, event_seq)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (tenant_id, run_id)
       DO UPDATE SET
         workspace_id = EXCLUDED.workspace_id,
         workflow_id = EXCLUDED.workflow_id,
         status = EXCLUDED.status,
         initiated_by_user_id = EXCLUDED.initiated_by_user_id,
         started_at = EXCLUDED.started_at,
         ended_at = EXCLUDED.ended_at,
         event_seq = EXCLUDED.event_seq
       WHERE EXCLUDED.event_seq > workflow_runs.event_seq`,
      [
        event.tenantId,
        event.runId,
        event.workspaceId,
        event.workflowId,
        event.status,
        event.initiatedByUserId ?? null,
        event.createdAtIso,
        event.startedAtIso ?? null,
        event.endedAtIso ?? null,
        event.eventSeq,
      ],
    );
  }

  async upsertWorkspace(event: WorkspaceProjectionEvent): Promise<void> {
    await this.sql.query(
      `INSERT INTO workspace_summary
         (tenant_id, workspace_id, name, status, created_at, event_seq)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_id, workspace_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         event_seq = EXCLUDED.event_seq
       WHERE EXCLUDED.event_seq > workspace_summary.event_seq`,
      [
        event.tenantId,
        event.workspaceId,
        event.name,
        event.status,
        event.createdAtIso,
        event.eventSeq,
      ],
    );
  }
}
