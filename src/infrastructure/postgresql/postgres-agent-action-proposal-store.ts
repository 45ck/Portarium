/**
 * bead-0877: PostgreSQL adapter for AgentActionProposalStore.
 *
 * Persists agent action proposals to the `agent_action_proposals` table
 * (added in migration 0015). Uses JSONB payload column with ON CONFLICT
 * upsert for idempotent saves.
 */

import type { AgentActionProposalV1 } from '../../domain/machines/index.js';
import { parseAgentActionProposalV1 } from '../../domain/machines/agent-action-proposal-v1.js';
import type { ProposalId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { AgentActionProposalStore } from '../../application/ports/agent-action-proposal-store.js';
import type { SqlClient } from './sql-client.js';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface AgentActionProposalRow extends Record<string, unknown> {
  tenant_id: string;
  proposal_id: string;
  workspace_id: string;
  payload: unknown;
}

// ---------------------------------------------------------------------------
// PostgresAgentActionProposalStore
// ---------------------------------------------------------------------------

export class PostgresAgentActionProposalStore implements AgentActionProposalStore {
  readonly #client: SqlClient;

  public constructor(client: SqlClient) {
    this.#client = client;
  }

  // -------------------------------------------------------------------------
  // getProposalById
  // -------------------------------------------------------------------------

  public async getProposalById(
    tenantId: TenantId,
    proposalId: ProposalId,
  ): Promise<AgentActionProposalV1 | null> {
    const result = await this.#client.query<AgentActionProposalRow>(
      `SELECT tenant_id, proposal_id, workspace_id, payload
         FROM agent_action_proposals
        WHERE tenant_id = $1 AND proposal_id = $2
        LIMIT 1`,
      [String(tenantId), String(proposalId)],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return parseAgentActionProposalV1(row.payload);
  }

  // -------------------------------------------------------------------------
  // getProposalByIdempotencyKey
  // -------------------------------------------------------------------------

  public async getProposalByIdempotencyKey(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    idempotencyKey: string,
  ): Promise<AgentActionProposalV1 | null> {
    const result = await this.#client.query<AgentActionProposalRow>(
      `SELECT tenant_id, proposal_id, workspace_id, payload
         FROM agent_action_proposals
        WHERE tenant_id = $1 AND workspace_id = $2 AND idempotency_key = $3
        LIMIT 1`,
      [String(tenantId), String(workspaceId), idempotencyKey],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return parseAgentActionProposalV1(row.payload);
  }

  // -------------------------------------------------------------------------
  // saveProposal
  // -------------------------------------------------------------------------

  public async saveProposal(
    tenantId: TenantId,
    proposal: AgentActionProposalV1,
  ): Promise<void> {
    await this.#client.query(
      `INSERT INTO agent_action_proposals
         (tenant_id, proposal_id, workspace_id, payload, idempotency_key, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
       ON CONFLICT (tenant_id, proposal_id)
       DO UPDATE SET
         workspace_id    = EXCLUDED.workspace_id,
         payload         = EXCLUDED.payload,
         idempotency_key = EXCLUDED.idempotency_key,
         updated_at      = NOW()`,
      [
        String(tenantId),
        String(proposal.proposalId),
        String(proposal.workspaceId),
        JSON.stringify(proposal),
        proposal.idempotencyKey ?? null,
      ],
    );
  }
}
