import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PaymentV1 } from '../../../domain/canonical/payment-v1.js';
import { PaymentId } from '../../../domain/primitives/index.js';
import type {
  PayrollAdapterPort,
  PayrollExecuteInputV1,
  PayrollExecuteOutputV1,
} from '../../../application/ports/payroll-adapter.js';
import { PAYROLL_OPERATIONS_V1 } from '../../../application/ports/payroll-adapter.js';

const OPERATION_SET = new Set<string>(PAYROLL_OPERATIONS_V1);

type TenantExternalRef = Readonly<{
  tenantId: PayrollExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type InMemoryPayrollAdapterSeed = Readonly<{
  payrollRuns?: readonly TenantExternalRef[];
  payStubs?: readonly TenantExternalRef[];
  taxCalculations?: readonly TenantExternalRef[];
  paySchedules?: readonly TenantExternalRef[];
  deductions?: readonly TenantExternalRef[];
  earnings?: readonly TenantExternalRef[];
  contractorPayments?: readonly PaymentV1[];
}>;

type InMemoryPayrollAdapterParams = Readonly<{
  seed?: InMemoryPayrollAdapterSeed;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class InMemoryPayrollAdapter implements PayrollAdapterPort {
  readonly #payrollRuns: TenantExternalRef[];
  readonly #payStubs: TenantExternalRef[];
  readonly #taxCalculations: TenantExternalRef[];
  readonly #paySchedules: TenantExternalRef[];
  readonly #deductions: TenantExternalRef[];
  readonly #earnings: TenantExternalRef[];
  readonly #contractorPayments: PaymentV1[];
  #payrollRunSequence: number;
  #taxCalculationSequence: number;
  #approvalSequence: number;

  public constructor(params?: InMemoryPayrollAdapterParams) {
    this.#payrollRuns = [...(params?.seed?.payrollRuns ?? [])];
    this.#payStubs = [...(params?.seed?.payStubs ?? [])];
    this.#taxCalculations = [...(params?.seed?.taxCalculations ?? [])];
    this.#paySchedules = [...(params?.seed?.paySchedules ?? [])];
    this.#deductions = [...(params?.seed?.deductions ?? [])];
    this.#earnings = [...(params?.seed?.earnings ?? [])];
    this.#contractorPayments = [...(params?.seed?.contractorPayments ?? [])];
    this.#payrollRunSequence = this.#payrollRuns.length;
    this.#taxCalculationSequence = this.#taxCalculations.length;
    this.#approvalSequence = 0;
  }

  public async execute(input: PayrollExecuteInputV1): Promise<PayrollExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported Payroll operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'runPayroll':
        return this.#runPayroll(input);
      case 'getPayrollRun':
        return this.#getExternalById(
          this.#payrollRuns,
          input,
          'payrollRunId',
          'Payroll run',
          'getPayrollRun',
        );
      case 'listPayrollRuns':
        return { ok: true, result: { kind: 'externalRefs', externalRefs: this.#listForTenant(this.#payrollRuns, input) } };
      case 'getPayStub':
        return this.#getExternalById(this.#payStubs, input, 'payStubId', 'Pay stub', 'getPayStub');
      case 'listPayStubs':
        return { ok: true, result: { kind: 'externalRefs', externalRefs: this.#listForTenant(this.#payStubs, input) } };
      case 'calculateTax':
        return this.#calculateTax(input);
      case 'getPaySchedule':
        return this.#getExternalById(
          this.#paySchedules,
          input,
          'scheduleId',
          'Pay schedule',
          'getPaySchedule',
        );
      case 'listDeductions':
        return { ok: true, result: { kind: 'externalRefs', externalRefs: this.#listForTenant(this.#deductions, input) } };
      case 'listEarnings':
        return { ok: true, result: { kind: 'externalRefs', externalRefs: this.#listForTenant(this.#earnings, input) } };
      case 'submitPayrollForApproval':
        return this.#submitPayrollForApproval(input);
      case 'approvePayroll':
        return this.#approvePayroll(input);
      case 'listContractorPayments':
        return {
          ok: true,
          result: { kind: 'payments', payments: this.#listContractorPayments(input) },
        };
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported Payroll operation: ${String(input.operation)}.`,
        };
    }
  }

  #runPayroll(input: PayrollExecuteInputV1): PayrollExecuteOutputV1 {
    const externalRef: ExternalObjectRef = {
      sorName: 'PayrollSuite',
      portFamily: 'Payroll',
      externalId: `payrun-${++this.#payrollRunSequence}`,
      externalType: 'payroll_run',
      displayLabel:
        (typeof input.payload?.['periodLabel'] === 'string'
          ? input.payload['periodLabel']
          : `Payroll Run ${this.#payrollRunSequence}`),
    };
    this.#payrollRuns.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #calculateTax(input: PayrollExecuteInputV1): PayrollExecuteOutputV1 {
    const externalRef: ExternalObjectRef = {
      sorName: 'PayrollSuite',
      portFamily: 'Payroll',
      externalId: `tax-${++this.#taxCalculationSequence}`,
      externalType: 'tax_calculation',
      displayLabel:
        (typeof input.payload?.['label'] === 'string'
          ? input.payload['label']
          : `Tax Calculation ${this.#taxCalculationSequence}`),
    };
    this.#taxCalculations.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #submitPayrollForApproval(input: PayrollExecuteInputV1): PayrollExecuteOutputV1 {
    const payrollRunId = readString(input.payload, 'payrollRunId');
    if (payrollRunId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'payrollRunId is required for submitPayrollForApproval.',
      };
    }
    const existingRun = this.#payrollRuns.find(
      (run) => run.tenantId === input.tenantId && run.externalRef.externalId === payrollRunId,
    );
    if (existingRun === undefined) {
      return { ok: false, error: 'not_found', message: `Payroll run ${payrollRunId} was not found.` };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'PayrollSuite',
      portFamily: 'Payroll',
      externalId: `approval-submission-${++this.#approvalSequence}`,
      externalType: 'payroll_approval_submission',
      displayLabel: `Submitted ${payrollRunId} for approval`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #approvePayroll(input: PayrollExecuteInputV1): PayrollExecuteOutputV1 {
    const payrollRunId = readString(input.payload, 'payrollRunId');
    if (payrollRunId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'payrollRunId is required for approvePayroll.',
      };
    }
    const decision = readString(input.payload, 'decision');
    if (decision === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'decision is required for approvePayroll.',
      };
    }
    const existingRun = this.#payrollRuns.find(
      (run) => run.tenantId === input.tenantId && run.externalRef.externalId === payrollRunId,
    );
    if (existingRun === undefined) {
      return { ok: false, error: 'not_found', message: `Payroll run ${payrollRunId} was not found.` };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'PayrollSuite',
      portFamily: 'Payroll',
      externalId: `approval-${++this.#approvalSequence}`,
      externalType: 'payroll_approval_decision',
      displayLabel: `${payrollRunId} decision: ${decision}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #getExternalById(
    source: readonly TenantExternalRef[],
    input: PayrollExecuteInputV1,
    payloadKey: string,
    label: string,
    operationName: string,
  ): PayrollExecuteOutputV1 {
    const externalId = readString(input.payload, payloadKey);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${payloadKey} is required for ${operationName}.`,
      };
    }
    const row = source.find(
      (item) => item.tenantId === input.tenantId && item.externalRef.externalId === externalId,
    );
    if (row === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: row.externalRef } };
  }

  #listForTenant(
    source: readonly TenantExternalRef[],
    input: PayrollExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((item) => item.tenantId === input.tenantId)
      .map((item) => item.externalRef);
  }

  #listContractorPayments(input: PayrollExecuteInputV1): readonly PaymentV1[] {
    const status = readString(input.payload, 'status');
    return this.#contractorPayments.filter(
      (payment) => payment.tenantId === input.tenantId && (status === null || payment.status === status),
    );
  }

  public static seedMinimal(tenantId: PayrollExecuteInputV1['tenantId']): InMemoryPayrollAdapterSeed {
    return {
      payrollRuns: [
        {
          tenantId,
          externalRef: {
            sorName: 'PayrollSuite',
            portFamily: 'Payroll',
            externalId: 'payrun-1000',
            externalType: 'payroll_run',
            displayLabel: 'January 2026 Payroll',
          },
        },
      ],
      payStubs: [
        {
          tenantId,
          externalRef: {
            sorName: 'PayrollSuite',
            portFamily: 'Payroll',
            externalId: 'paystub-1000',
            externalType: 'pay_stub',
            displayLabel: 'Employee 1000 January Stub',
          },
        },
      ],
      taxCalculations: [
        {
          tenantId,
          externalRef: {
            sorName: 'PayrollSuite',
            portFamily: 'Payroll',
            externalId: 'tax-1000',
            externalType: 'tax_calculation',
            displayLabel: 'January Tax Calculation',
          },
        },
      ],
      paySchedules: [
        {
          tenantId,
          externalRef: {
            sorName: 'PayrollSuite',
            portFamily: 'Payroll',
            externalId: 'schedule-1000',
            externalType: 'pay_schedule',
            displayLabel: 'Biweekly Schedule',
          },
        },
      ],
      deductions: [
        {
          tenantId,
          externalRef: {
            sorName: 'PayrollSuite',
            portFamily: 'Payroll',
            externalId: 'deduction-1000',
            externalType: 'deduction',
            displayLabel: 'Retirement 401k',
          },
        },
      ],
      earnings: [
        {
          tenantId,
          externalRef: {
            sorName: 'PayrollSuite',
            portFamily: 'Payroll',
            externalId: 'earning-1000',
            externalType: 'earning',
            displayLabel: 'Base Salary',
          },
        },
      ],
      contractorPayments: [
        {
          paymentId: PaymentId('contractor-payment-1000'),
          tenantId,
          schemaVersion: 1,
          amount: 1800,
          currencyCode: 'USD',
          status: 'completed',
          paidAtIso: '2026-01-31T00:00:00.000Z',
        },
      ],
    };
  }
}
