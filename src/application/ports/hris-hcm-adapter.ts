import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../domain/canonical/party-v1.js';
import type { SubscriptionV1 } from '../../domain/canonical/subscription-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const HRIS_HCM_OPERATIONS_V1 = [
  'listEmployees',
  'getEmployee',
  'createEmployee',
  'updateEmployee',
  'terminateEmployee',
  'listDepartments',
  'getDepartment',
  'listJobPositions',
  'getTimeOff',
  'requestTimeOff',
  'listBenefitEnrolments',
  'getCompanyStructure',
] as const;

export type HrisHcmOperationV1 = (typeof HRIS_HCM_OPERATIONS_V1)[number];

export type HrisHcmOperationResultV1 =
  | Readonly<{ kind: 'employee'; employee: PartyV1 }>
  | Readonly<{ kind: 'employees'; employees: readonly PartyV1[] }>
  | Readonly<{ kind: 'benefits'; benefits: readonly SubscriptionV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: HrisHcmOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type HrisHcmExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: HrisHcmOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type HrisHcmExecuteOutputV1 =
  | Readonly<{ ok: true; result: HrisHcmOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface HrisHcmAdapterPort {
  execute(input: HrisHcmExecuteInputV1): Promise<HrisHcmExecuteOutputV1>;
}
