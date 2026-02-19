import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { OrderV1 } from '../../../domain/canonical/order-v1.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import type { SubscriptionV1 } from '../../../domain/canonical/subscription-v1.js';
import { OrderId, PartyId, SubscriptionId } from '../../../domain/primitives/index.js';
import type {
  ProcurementSpendAdapterPort,
  ProcurementSpendExecuteInputV1,
  ProcurementSpendExecuteOutputV1,
} from '../../../application/ports/procurement-spend-adapter.js';
import { PROCUREMENT_SPEND_OPERATIONS_V1 } from '../../../application/ports/procurement-spend-adapter.js';

const OPERATION_SET = new Set<string>(PROCUREMENT_SPEND_OPERATIONS_V1);

type InMemoryProcurementSpendAdapterSeed = Readonly<{
  purchaseOrders?: readonly OrderV1[];
  vendors?: readonly PartyV1[];
  contracts?: readonly SubscriptionV1[];
  expenseReports?: readonly ExternalObjectRef[];
  rfqs?: readonly ExternalObjectRef[];
}>;

type InMemoryProcurementSpendAdapterParams = Readonly<{
  seed?: InMemoryProcurementSpendAdapterSeed;
  now?: () => Date;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(payload: Readonly<Record<string, unknown>> | undefined, key: string): number | null {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class InMemoryProcurementSpendAdapter implements ProcurementSpendAdapterPort {
  readonly #now: () => Date;
  readonly #purchaseOrders: OrderV1[];
  readonly #vendors: PartyV1[];
  readonly #contracts: SubscriptionV1[];
  readonly #expenseReports: ExternalObjectRef[];
  readonly #rfqs: ExternalObjectRef[];
  #orderSequence: number;
  #vendorSequence: number;
  #contractSequence: number;
  #expenseSequence: number;
  #rfqSequence: number;

  public constructor(params?: InMemoryProcurementSpendAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#purchaseOrders = [...(params?.seed?.purchaseOrders ?? [])];
    this.#vendors = [...(params?.seed?.vendors ?? [])];
    this.#contracts = [...(params?.seed?.contracts ?? [])];
    this.#expenseReports = [...(params?.seed?.expenseReports ?? [])];
    this.#rfqs = [...(params?.seed?.rfqs ?? [])];
    this.#orderSequence = this.#purchaseOrders.length;
    this.#vendorSequence = this.#vendors.length;
    this.#contractSequence = this.#contracts.length;
    this.#expenseSequence = this.#expenseReports.length;
    this.#rfqSequence = this.#rfqs.length;
  }

  public async execute(
    input: ProcurementSpendExecuteInputV1,
  ): Promise<ProcurementSpendExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported ProcurementSpend operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'createPurchaseOrder':
        return this.#createPurchaseOrder(input);
      case 'getPurchaseOrder':
        return this.#getPurchaseOrder(input);
      case 'approvePurchaseOrder':
        return this.#approvePurchaseOrder(input);
      case 'listPurchaseOrders':
        return {
          ok: true,
          result: { kind: 'orders', orders: this.#listPurchaseOrders(input) },
        };
      case 'createExpenseReport':
        return this.#createExpenseReport(input);
      case 'getExpenseReport':
        return this.#getExpenseReport(input);
      case 'approveExpenseReport':
        return this.#approveExpenseReport(input);
      case 'listExpenseReports':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listExpenseReports(input) },
        };
      case 'createVendor':
        return this.#createVendor(input);
      case 'getVendor':
        return this.#getVendor(input);
      case 'listVendors':
        return {
          ok: true,
          result: { kind: 'vendors', vendors: this.#listVendors(input) },
        };
      case 'createRFQ':
        return this.#createRFQ(input);
      case 'listContracts':
        return {
          ok: true,
          result: { kind: 'contracts', contracts: this.#listContracts(input) },
        };
      case 'getContract':
        return this.#getContract(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported ProcurementSpend operation: ${String(input.operation)}.`,
        };
    }
  }

  #createPurchaseOrder(input: ProcurementSpendExecuteInputV1): ProcurementSpendExecuteOutputV1 {
    const totalAmount = readNumber(input.payload, 'totalAmount');
    if (totalAmount === null || totalAmount < 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'totalAmount must be a non-negative number for createPurchaseOrder.',
      };
    }

    const order: OrderV1 = {
      orderId: OrderId(`po-${++this.#orderSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      orderNumber:
        (typeof input.payload?.['orderNumber'] === 'string'
          ? input.payload['orderNumber']
          : `PO-${this.#orderSequence}`) as string,
      status: 'draft',
      totalAmount,
      currencyCode:
        (typeof input.payload?.['currencyCode'] === 'string'
          ? input.payload['currencyCode']
          : 'USD') as string,
      createdAtIso: this.#now().toISOString(),
      ...(typeof input.payload?.['lineItemCount'] === 'number'
        ? { lineItemCount: input.payload['lineItemCount'] as number }
        : {}),
    };

    this.#purchaseOrders.push(order);
    return { ok: true, result: { kind: 'order', order } };
  }

  #getPurchaseOrder(input: ProcurementSpendExecuteInputV1): ProcurementSpendExecuteOutputV1 {
    const orderId = readString(input.payload, 'orderId');
    if (orderId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'orderId is required for getPurchaseOrder.',
      };
    }
    const order = this.#purchaseOrders.find(
      (item) => item.tenantId === input.tenantId && item.orderId === orderId,
    );
    if (order === undefined) {
      return { ok: false, error: 'not_found', message: `Purchase order ${orderId} was not found.` };
    }
    return { ok: true, result: { kind: 'order', order } };
  }

  #approvePurchaseOrder(input: ProcurementSpendExecuteInputV1): ProcurementSpendExecuteOutputV1 {
    const orderId = readString(input.payload, 'orderId');
    if (orderId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'orderId is required for approvePurchaseOrder.',
      };
    }
    const index = this.#purchaseOrders.findIndex(
      (item) => item.tenantId === input.tenantId && item.orderId === orderId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Purchase order ${orderId} was not found.` };
    }
    const approved: OrderV1 = { ...this.#purchaseOrders[index]!, status: 'confirmed' };
    this.#purchaseOrders[index] = approved;
    return { ok: true, result: { kind: 'order', order: approved } };
  }

  #listPurchaseOrders(input: ProcurementSpendExecuteInputV1): readonly OrderV1[] {
    return this.#purchaseOrders.filter((order) => order.tenantId === input.tenantId);
  }

  #createExpenseReport(input: ProcurementSpendExecuteInputV1): ProcurementSpendExecuteOutputV1 {
    const externalRef: ExternalObjectRef = {
      sorName: 'ProcurementSuite',
      portFamily: 'ProcurementSpend',
      externalId: `expense-${++this.#expenseSequence}`,
      externalType: 'expense_report',
      displayLabel:
        (typeof input.payload?.['title'] === 'string'
          ? input.payload['title']
          : `Expense ${this.#expenseSequence}`) as string,
    };
    this.#expenseReports.push(externalRef);
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #getExpenseReport(input: ProcurementSpendExecuteInputV1): ProcurementSpendExecuteOutputV1 {
    const externalId = readString(input.payload, 'externalId');
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'externalId is required for getExpenseReport.',
      };
    }
    const externalRef = this.#expenseReports.find((item) => item.externalId === externalId);
    if (externalRef === undefined) {
      return { ok: false, error: 'not_found', message: `Expense report ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #approveExpenseReport(input: ProcurementSpendExecuteInputV1): ProcurementSpendExecuteOutputV1 {
    const externalId = readString(input.payload, 'externalId');
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'externalId is required for approveExpenseReport.',
      };
    }
    const externalRef = this.#expenseReports.find((item) => item.externalId === externalId);
    if (externalRef === undefined) {
      return { ok: false, error: 'not_found', message: `Expense report ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'accepted', operation: 'approveExpenseReport' } };
  }

  #listExpenseReports(_input: ProcurementSpendExecuteInputV1): readonly ExternalObjectRef[] {
    return this.#expenseReports;
  }

  #createVendor(input: ProcurementSpendExecuteInputV1): ProcurementSpendExecuteOutputV1 {
    const displayName = readString(input.payload, 'displayName');
    if (displayName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'displayName is required for createVendor.',
      };
    }

    const vendor: PartyV1 = {
      partyId: PartyId(`vendor-${++this.#vendorSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      displayName,
      roles: ['vendor'],
      ...(typeof input.payload?.['email'] === 'string' ? { email: input.payload['email'] as string } : {}),
      ...(typeof input.payload?.['phone'] === 'string' ? { phone: input.payload['phone'] as string } : {}),
    };
    this.#vendors.push(vendor);
    return { ok: true, result: { kind: 'vendor', vendor } };
  }

  #getVendor(input: ProcurementSpendExecuteInputV1): ProcurementSpendExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return { ok: false, error: 'validation_error', message: 'partyId is required for getVendor.' };
    }
    const vendor = this.#vendors.find(
      (item) => item.tenantId === input.tenantId && item.partyId === partyId,
    );
    if (vendor === undefined) {
      return { ok: false, error: 'not_found', message: `Vendor ${partyId} was not found.` };
    }
    return { ok: true, result: { kind: 'vendor', vendor } };
  }

  #listVendors(input: ProcurementSpendExecuteInputV1): readonly PartyV1[] {
    return this.#vendors.filter((vendor) => vendor.tenantId === input.tenantId);
  }

  #createRFQ(_input: ProcurementSpendExecuteInputV1): ProcurementSpendExecuteOutputV1 {
    const externalRef: ExternalObjectRef = {
      sorName: 'ProcurementSuite',
      portFamily: 'ProcurementSpend',
      externalId: `rfq-${++this.#rfqSequence}`,
      externalType: 'rfq',
      displayLabel: `RFQ-${this.#rfqSequence}`,
    };
    this.#rfqs.push(externalRef);
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listContracts(input: ProcurementSpendExecuteInputV1): readonly SubscriptionV1[] {
    return this.#contracts.filter((contract) => contract.tenantId === input.tenantId);
  }

  #getContract(input: ProcurementSpendExecuteInputV1): ProcurementSpendExecuteOutputV1 {
    const subscriptionId = readString(input.payload, 'subscriptionId');
    if (subscriptionId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'subscriptionId is required for getContract.',
      };
    }
    const contract = this.#contracts.find(
      (item) => item.tenantId === input.tenantId && item.subscriptionId === subscriptionId,
    );
    if (contract === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `Contract ${subscriptionId} was not found.`,
      };
    }
    return { ok: true, result: { kind: 'contract', contract } };
  }

  public static seedMinimal(
    tenantId: ProcurementSpendExecuteInputV1['tenantId'],
  ): InMemoryProcurementSpendAdapterSeed {
    return {
      purchaseOrders: [
        {
          orderId: OrderId('po-1000'),
          tenantId,
          schemaVersion: 1,
          orderNumber: 'PO-1000',
          status: 'draft',
          totalAmount: 450,
          currencyCode: 'USD',
          createdAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
      vendors: [
        {
          partyId: PartyId('vendor-1000'),
          tenantId,
          schemaVersion: 1,
          displayName: 'Default Supplier',
          roles: ['vendor'],
        },
      ],
      contracts: [
        {
          subscriptionId: SubscriptionId('contract-1000'),
          tenantId,
          schemaVersion: 1,
          planName: 'MSA 2026',
          status: 'active',
        },
      ],
      expenseReports: [
        {
          sorName: 'ProcurementSuite',
          portFamily: 'ProcurementSpend',
          externalId: 'expense-1000',
          externalType: 'expense_report',
          displayLabel: 'Expense 1000',
        },
      ],
      rfqs: [
        {
          sorName: 'ProcurementSuite',
          portFamily: 'ProcurementSpend',
          externalId: 'rfq-1000',
          externalType: 'rfq',
          displayLabel: 'RFQ 1000',
        },
      ],
    };
  }
}
