import type { PlanV1 } from '../../domain/plan/index.js';
import type { PlanId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';

export interface PlanQueryStore {
  getPlanById(tenantId: TenantId, workspaceId: WorkspaceId, planId: PlanId): Promise<PlanV1 | null>;
}
