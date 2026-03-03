import type { ProposalId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { AgentActionProposalV1 } from '../../domain/machines/index.js';
import type { AgentActionProposalStore } from '../../application/ports/agent-action-proposal-store.js';

export class InMemoryAgentActionProposalStore implements AgentActionProposalStore {
  readonly #store = new Map<string, AgentActionProposalV1>();

  public async getProposalById(
    tenantId: TenantId,
    proposalId: ProposalId,
  ): Promise<AgentActionProposalV1 | null> {
    return this.#store.get(this.#key(tenantId, proposalId)) ?? null;
  }

  public async getProposalByIdempotencyKey(
    _tenantId: TenantId,
    workspaceId: WorkspaceId,
    idempotencyKey: string,
  ): Promise<AgentActionProposalV1 | null> {
    for (const proposal of this.#store.values()) {
      if (
        proposal.idempotencyKey === idempotencyKey &&
        String(proposal.workspaceId) === String(workspaceId)
      ) {
        return proposal;
      }
    }
    return null;
  }

  public async saveProposal(
    tenantId: TenantId,
    proposal: AgentActionProposalV1,
  ): Promise<void> {
    this.#store.set(this.#key(tenantId, proposal.proposalId), proposal);
  }

  #key(tenantId: TenantId, proposalId: ProposalId): string {
    return `${String(tenantId)}:${String(proposalId)}`;
  }
}
