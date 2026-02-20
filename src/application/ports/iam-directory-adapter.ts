import type { AssetV1 } from '../../domain/canonical/asset-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../domain/canonical/party-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const IAM_DIRECTORY_OPERATIONS_V1 = [
  'listUsers',
  'getUser',
  'createUser',
  'updateUser',
  'deactivateUser',
  'listGroups',
  'getGroup',
  'createGroup',
  'addUserToGroup',
  'removeUserFromGroup',
  'listRoles',
  'assignRole',
  'revokeRole',
  'listApplications',
  'getApplication',
  'authenticateUser',
  'verifyMFA',
  'listAuditLogs',
] as const;

export type IamDirectoryOperationV1 = (typeof IAM_DIRECTORY_OPERATIONS_V1)[number];

export type IamDirectoryOperationResultV1 =
  | Readonly<{ kind: 'party'; party: PartyV1 }>
  | Readonly<{ kind: 'parties'; parties: readonly PartyV1[] }>
  | Readonly<{ kind: 'asset'; asset: AssetV1 }>
  | Readonly<{ kind: 'assets'; assets: readonly AssetV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: IamDirectoryOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type IamDirectoryExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: IamDirectoryOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type IamDirectoryExecuteOutputV1 =
  | Readonly<{ ok: true; result: IamDirectoryOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface IamDirectoryAdapterPort {
  execute(input: IamDirectoryExecuteInputV1): Promise<IamDirectoryExecuteOutputV1>;
}
