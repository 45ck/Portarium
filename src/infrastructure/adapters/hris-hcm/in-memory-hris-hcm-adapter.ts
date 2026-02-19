import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import type { SubscriptionV1 } from '../../../domain/canonical/subscription-v1.js';
import { PartyId, SubscriptionId } from '../../../domain/primitives/index.js';
import type {
  HrisHcmAdapterPort,
  HrisHcmExecuteInputV1,
  HrisHcmExecuteOutputV1,
} from '../../../application/ports/hris-hcm-adapter.js';
import { HRIS_HCM_OPERATIONS_V1 } from '../../../application/ports/hris-hcm-adapter.js';

const OPERATION_SET = new Set<string>(HRIS_HCM_OPERATIONS_V1);

type InMemoryHrisHcmAdapterSeed = Readonly<{
  employees?: readonly PartyV1[];
  departments?: readonly ExternalObjectRef[];
  jobPositions?: readonly ExternalObjectRef[];
  timeOffRecords?: readonly ExternalObjectRef[];
  benefitEnrolments?: readonly SubscriptionV1[];
  companyStructure?: ExternalObjectRef;
}>;

type InMemoryHrisHcmAdapterParams = Readonly<{
  seed?: InMemoryHrisHcmAdapterSeed;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class InMemoryHrisHcmAdapter implements HrisHcmAdapterPort {
  readonly #employees: PartyV1[];
  readonly #departments: ExternalObjectRef[];
  readonly #jobPositions: ExternalObjectRef[];
  readonly #timeOffRecords: ExternalObjectRef[];
  readonly #benefitEnrolments: SubscriptionV1[];
  readonly #companyStructure: ExternalObjectRef;
  #employeeSequence: number;
  #timeOffSequence: number;

  public constructor(params?: InMemoryHrisHcmAdapterParams) {
    this.#employees = [...(params?.seed?.employees ?? [])];
    this.#departments = [...(params?.seed?.departments ?? [])];
    this.#jobPositions = [...(params?.seed?.jobPositions ?? [])];
    this.#timeOffRecords = [...(params?.seed?.timeOffRecords ?? [])];
    this.#benefitEnrolments = [...(params?.seed?.benefitEnrolments ?? [])];
    this.#companyStructure = params?.seed?.companyStructure ?? {
      sorName: 'HrisSuite',
      portFamily: 'HrisHcm',
      externalId: 'org-1000',
      externalType: 'org_structure',
      displayLabel: 'Company Structure',
    };
    this.#employeeSequence = this.#employees.length;
    this.#timeOffSequence = this.#timeOffRecords.length;
  }

  public async execute(input: HrisHcmExecuteInputV1): Promise<HrisHcmExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported HrisHcm operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listEmployees':
        return { ok: true, result: { kind: 'employees', employees: this.#listEmployees(input) } };
      case 'getEmployee':
        return this.#getEmployee(input);
      case 'createEmployee':
        return this.#createEmployee(input);
      case 'updateEmployee':
        return this.#updateEmployee(input);
      case 'terminateEmployee':
        return this.#terminateEmployee(input);
      case 'listDepartments':
        return { ok: true, result: { kind: 'externalRefs', externalRefs: this.#departments } };
      case 'getDepartment':
        return this.#getExternalById(this.#departments, input, 'departmentId', 'Department');
      case 'listJobPositions':
        return { ok: true, result: { kind: 'externalRefs', externalRefs: this.#jobPositions } };
      case 'getTimeOff':
        return this.#getExternalById(this.#timeOffRecords, input, 'timeOffId', 'Time-off record');
      case 'requestTimeOff':
        return this.#requestTimeOff(input);
      case 'listBenefitEnrolments':
        return { ok: true, result: { kind: 'benefits', benefits: this.#benefitEnrolments } };
      case 'getCompanyStructure':
        return { ok: true, result: { kind: 'externalRef', externalRef: this.#companyStructure } };
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported HrisHcm operation: ${String(input.operation)}.`,
        };
    }
  }

  #listEmployees(input: HrisHcmExecuteInputV1): readonly PartyV1[] {
    return this.#employees.filter((employee) => employee.tenantId === input.tenantId);
  }

  #getEmployee(input: HrisHcmExecuteInputV1): HrisHcmExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return { ok: false, error: 'validation_error', message: 'partyId is required for getEmployee.' };
    }
    const employee = this.#employees.find(
      (item) => item.tenantId === input.tenantId && item.partyId === partyId,
    );
    if (employee === undefined) {
      return { ok: false, error: 'not_found', message: `Employee ${partyId} was not found.` };
    }
    return { ok: true, result: { kind: 'employee', employee } };
  }

  #createEmployee(input: HrisHcmExecuteInputV1): HrisHcmExecuteOutputV1 {
    const displayName = readString(input.payload, 'displayName');
    if (displayName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'displayName is required for createEmployee.',
      };
    }

    const employee: PartyV1 = {
      partyId: PartyId(`employee-${++this.#employeeSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      displayName,
      roles: ['employee'],
      ...(typeof input.payload?.['email'] === 'string' ? { email: input.payload['email'] as string } : {}),
    };
    this.#employees.push(employee);
    return { ok: true, result: { kind: 'employee', employee } };
  }

  #updateEmployee(input: HrisHcmExecuteInputV1): HrisHcmExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'partyId is required for updateEmployee.',
      };
    }
    const index = this.#employees.findIndex(
      (item) => item.tenantId === input.tenantId && item.partyId === partyId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Employee ${partyId} was not found.` };
    }
    const current = this.#employees[index]!;
    const next: PartyV1 = {
      ...current,
      ...(typeof input.payload?.['displayName'] === 'string'
        ? { displayName: input.payload['displayName'] as string }
        : {}),
      ...(typeof input.payload?.['email'] === 'string' ? { email: input.payload['email'] as string } : {}),
      ...(typeof input.payload?.['phone'] === 'string' ? { phone: input.payload['phone'] as string } : {}),
    };
    this.#employees[index] = next;
    return { ok: true, result: { kind: 'employee', employee: next } };
  }

  #terminateEmployee(input: HrisHcmExecuteInputV1): HrisHcmExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'partyId is required for terminateEmployee.',
      };
    }
    const employee = this.#employees.find(
      (item) => item.tenantId === input.tenantId && item.partyId === partyId,
    );
    if (employee === undefined) {
      return { ok: false, error: 'not_found', message: `Employee ${partyId} was not found.` };
    }
    return { ok: true, result: { kind: 'accepted', operation: 'terminateEmployee' } };
  }

  #getExternalById(
    source: readonly ExternalObjectRef[],
    input: HrisHcmExecuteInputV1,
    payloadKey: string,
    label: string,
  ): HrisHcmExecuteOutputV1 {
    const externalId = readString(input.payload, payloadKey);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${payloadKey} is required.`,
      };
    }
    const externalRef = source.find((item) => item.externalId === externalId);
    if (externalRef === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #requestTimeOff(input: HrisHcmExecuteInputV1): HrisHcmExecuteOutputV1 {
    const externalRef: ExternalObjectRef = {
      sorName: 'HrisSuite',
      portFamily: 'HrisHcm',
      externalId: `timeoff-${++this.#timeOffSequence}`,
      externalType: 'time_off_request',
      displayLabel:
        (typeof input.payload?.['label'] === 'string'
          ? input.payload['label']
          : `Time Off ${this.#timeOffSequence}`) as string,
    };
    this.#timeOffRecords.push(externalRef);
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  public static seedMinimal(tenantId: HrisHcmExecuteInputV1['tenantId']): InMemoryHrisHcmAdapterSeed {
    return {
      employees: [
        {
          partyId: PartyId('employee-1000'),
          tenantId,
          schemaVersion: 1,
          displayName: 'Default Employee',
          roles: ['employee'],
        },
      ],
      departments: [
        {
          sorName: 'HrisSuite',
          portFamily: 'HrisHcm',
          externalId: 'dept-1000',
          externalType: 'department',
          displayLabel: 'Operations',
        },
      ],
      jobPositions: [
        {
          sorName: 'HrisSuite',
          portFamily: 'HrisHcm',
          externalId: 'position-1000',
          externalType: 'job_position',
          displayLabel: 'Operator',
        },
      ],
      timeOffRecords: [
        {
          sorName: 'HrisSuite',
          portFamily: 'HrisHcm',
          externalId: 'timeoff-1000',
          externalType: 'time_off_request',
          displayLabel: 'Vacation',
        },
      ],
      benefitEnrolments: [
        {
          subscriptionId: SubscriptionId('benefit-1000'),
          tenantId,
          schemaVersion: 1,
          planName: 'Health Plan A',
          status: 'active',
        },
      ],
      companyStructure: {
        sorName: 'HrisSuite',
        portFamily: 'HrisHcm',
        externalId: 'org-1000',
        externalType: 'org_structure',
        displayLabel: 'Company Structure',
      },
    };
  }
}
