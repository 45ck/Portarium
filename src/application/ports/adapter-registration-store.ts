import type { AdapterRegistrationV1 } from '../../domain/adapters/index.js';
import type { TenantId, WorkspaceId } from '../../domain/primitives/index.js';

export interface AdapterRegistrationStore {
  listByWorkspace(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
  ): Promise<readonly AdapterRegistrationV1[]>;
}
