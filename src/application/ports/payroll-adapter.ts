import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { PaymentV1 } from '../../domain/canonical/payment-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const PAYROLL_OPERATIONS_V1 = [
  'runPayroll',
  'getPayrollRun',
  'listPayrollRuns',
  'getPayStub',
  'listPayStubs',
  'calculateTax',
  'getPaySchedule',
  'listDeductions',
  'listEarnings',
  'submitPayrollForApproval',
  'approvePayroll',
  'listContractorPayments',
] as const;

export type PayrollOperationV1 = (typeof PAYROLL_OPERATIONS_V1)[number];

export type PayrollOperationResultV1 =
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'payment'; payment: PaymentV1 }>
  | Readonly<{ kind: 'payments'; payments: readonly PaymentV1[] }>
  | Readonly<{ kind: 'accepted'; operation: PayrollOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type PayrollExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: PayrollOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type PayrollExecuteOutputV1 =
  | Readonly<{ ok: true; result: PayrollOperationResultV1 }>
  | Readonly<{
      ok: false;
      error:
        | 'unsupported_operation'
        | 'not_found'
        | 'validation_error'
        | 'provider_error';
      message: string;
    }>;

export interface PayrollAdapterPort {
  execute(input: PayrollExecuteInputV1): Promise<PayrollExecuteOutputV1>;
}
