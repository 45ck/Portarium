import { type ApprovalId, type ProposalId, type TenantId, type WorkspaceId } from '../../domain/primitives/index.js';
import type { AgentActionProposalV1 } from '../../domain/machines/index.js';

export interface AgentActionProposalStore {
  getProposalById(
    tenantId: TenantId,
    proposalId: ProposalId,
  ): Promise<AgentActionProposalV1 | null>;
  getProposalByApprovalId(
    tenantId: TenantId,
    approvalId: ApprovalId,
  ): Promise<AgentActionProposalV1 | null>;
  getProposalByIdempotencyKey(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    idempotencyKey: string,
  ): Promise<AgentActionProposalV1 | null>;
  saveProposal(tenantId: TenantId, proposal: AgentActionProposalV1): Promise<void>;
}
