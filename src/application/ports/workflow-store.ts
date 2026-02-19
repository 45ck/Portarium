import { type TenantId, type WorkflowId, type WorkspaceId } from '../../domain/primitives/index.js';
import type { WorkflowV1 } from '../../domain/workflows/index.js';

export interface WorkflowStore {
  getWorkflowById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    workflowId: WorkflowId,
  ): Promise<WorkflowV1 | null>;
  listWorkflowsByName(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    workflowName: string,
  ): Promise<readonly WorkflowV1[]>;
}
