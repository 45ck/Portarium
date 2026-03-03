import { type ProposalId, type TenantId } from '../../domain/primitives/index.js';
import type { AgentActionProposalV1 } from '../../domain/machines/index.js';

export interface AgentActionProposalStore {
  getProposalById(
    tenantId: TenantId,
    proposalId: ProposalId,
  ): Promise<AgentActionProposalV1 | null>;
  saveProposal(tenantId: TenantId, proposal: AgentActionProposalV1): Promise<void>;
}
