import type { TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { WeeklyAutonomyDigestActionObservationV1 } from '../../domain/runs/index.js';

export type WeeklyAutonomyDigestActivityQuery = Readonly<{
  periodStartIso: string;
  periodEndIso: string;
  historyWindowStartIso: string;
}>;

export interface WeeklyAutonomyDigestActivityStore {
  listObservations(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    query: WeeklyAutonomyDigestActivityQuery,
  ): Promise<readonly WeeklyAutonomyDigestActionObservationV1[]>;
}
