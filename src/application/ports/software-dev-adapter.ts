import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const SOFTWARE_DEV_OPERATIONS_V1 = [
  'listPullRequests',
  'getPullRequest',
  'createPullRequest',
  'mergePullRequest',
  'listDeployments',
  'getDeployment',
  'createDeployment',
  'updateDeploymentStatus',
  'listRepositories',
  'getRepository',
  'listBranches',
  'getCommit',
  'listWorkflowRuns',
  'getDoraMetrics',
] as const;

export type SoftwareDevOperationV1 = (typeof SOFTWARE_DEV_OPERATIONS_V1)[number];

export type SoftwareDevOperationResultV1 =
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: SoftwareDevOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type SoftwareDevExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: SoftwareDevOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type SoftwareDevExecuteOutputV1 =
  | Readonly<{ ok: true; result: SoftwareDevOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface SoftwareDevAdapterPort {
  execute(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1>;
}
