import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { CanonicalTaskV1 } from '../../domain/canonical/task-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const PROJECTS_WORK_MGMT_OPERATIONS_V1 = [
  'listProjects',
  'getProject',
  'createProject',
  'listTasks',
  'getTask',
  'createTask',
  'updateTask',
  'deleteTask',
  'assignTask',
  'listBoards',
  'getBoard',
  'listSprints',
  'getSprint',
  'createSprint',
  'listMilestones',
  'getMilestone',
  'listComments',
  'addComment',
  'listLabels',
  'listTimeEntries',
  'logTime',
] as const;

export type ProjectsWorkMgmtOperationV1 = (typeof PROJECTS_WORK_MGMT_OPERATIONS_V1)[number];

export type ProjectsWorkMgmtOperationResultV1 =
  | Readonly<{ kind: 'task'; task: CanonicalTaskV1 }>
  | Readonly<{ kind: 'tasks'; tasks: readonly CanonicalTaskV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: ProjectsWorkMgmtOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type ProjectsWorkMgmtExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: ProjectsWorkMgmtOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type ProjectsWorkMgmtExecuteOutputV1 =
  | Readonly<{ ok: true; result: ProjectsWorkMgmtOperationResultV1 }>
  | Readonly<{
      ok: false;
      error:
        | 'unsupported_operation'
        | 'not_found'
        | 'validation_error'
        | 'provider_error';
      message: string;
    }>;

export interface ProjectsWorkMgmtAdapterPort {
  execute(input: ProjectsWorkMgmtExecuteInputV1): Promise<ProjectsWorkMgmtExecuteOutputV1>;
}
