import type { TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { DiffHunkV1 } from '../../domain/evidence/presentation-blocks-extended-v1.js';

export type BeadDiffHunk = DiffHunkV1 &
  Readonly<{
    hunkId: string;
    filePath: string;
    changeType: 'added' | 'modified' | 'deleted';
  }>;

export interface BeadDiffStore {
  getBeadDiff(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    beadId: string,
  ): Promise<readonly BeadDiffHunk[] | null>;
}
