import type { TenantId, WorkforceQueueId } from '../../domain/primitives/index.js';
import type { WorkforceQueueV1 } from '../../domain/workforce/index.js';

export interface WorkforceQueueStore {
  getWorkforceQueueById(
    tenantId: TenantId,
    workforceQueueId: WorkforceQueueId,
  ): Promise<WorkforceQueueV1 | null>;
}
