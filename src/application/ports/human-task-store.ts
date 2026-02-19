import type { HumanTaskId, TenantId } from '../../domain/primitives/index.js';
import type { HumanTaskV1 } from '../../domain/workforce/index.js';

export interface HumanTaskStore {
  getHumanTaskById(tenantId: TenantId, humanTaskId: HumanTaskId): Promise<HumanTaskV1 | null>;

  saveHumanTask(tenantId: TenantId, task: HumanTaskV1): Promise<void>;
}
