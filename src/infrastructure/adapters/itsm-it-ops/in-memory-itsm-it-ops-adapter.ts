import type { AssetV1 } from '../../../domain/canonical/asset-v1.js';
import type { TicketV1 } from '../../../domain/canonical/ticket-v1.js';
import { AssetId, TicketId } from '../../../domain/primitives/index.js';
import type {
  ItsmItOpsAdapterPort,
  ItsmItOpsExecuteInputV1,
  ItsmItOpsExecuteOutputV1,
} from '../../../application/ports/itsm-it-ops-adapter.js';
import { ITSM_IT_OPS_OPERATIONS_V1 } from '../../../application/ports/itsm-it-ops-adapter.js';

const OPERATION_SET = new Set<string>(ITSM_IT_OPS_OPERATIONS_V1);
const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
type TicketStatus = (typeof TICKET_STATUSES)[number];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type TicketPriority = (typeof TICKET_PRIORITIES)[number];
const ASSET_STATUSES = ['active', 'inactive', 'retired', 'maintenance'] as const;
type AssetStatus = (typeof ASSET_STATUSES)[number];

type InMemoryItsmItOpsAdapterSeed = Readonly<{
  incidents?: readonly TicketV1[];
  changeRequests?: readonly TicketV1[];
  assets?: readonly AssetV1[];
  cmdbItems?: readonly AssetV1[];
  problems?: readonly TicketV1[];
  serviceRequests?: readonly TicketV1[];
}>;

type InMemoryItsmItOpsAdapterParams = Readonly<{
  seed?: InMemoryItsmItOpsAdapterSeed;
  now?: () => Date;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readTicketStatus(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): TicketStatus | null {
  const value = payload?.[key];
  if (typeof value !== 'string') return null;
  return TICKET_STATUSES.includes(value as TicketStatus) ? (value as TicketStatus) : null;
}

function readTicketPriority(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): TicketPriority | null {
  const value = payload?.[key];
  if (typeof value !== 'string') return null;
  return TICKET_PRIORITIES.includes(value as TicketPriority) ? (value as TicketPriority) : null;
}

function readAssetStatus(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): AssetStatus | null {
  const value = payload?.[key];
  if (typeof value !== 'string') return null;
  return ASSET_STATUSES.includes(value as AssetStatus) ? (value as AssetStatus) : null;
}

export class InMemoryItsmItOpsAdapter implements ItsmItOpsAdapterPort {
  readonly #now: () => Date;
  readonly #incidents: TicketV1[];
  readonly #changeRequests: TicketV1[];
  readonly #assets: AssetV1[];
  readonly #cmdbItems: AssetV1[];
  readonly #problems: TicketV1[];
  readonly #serviceRequests: TicketV1[];
  #incidentSequence: number;
  #changeSequence: number;
  #problemSequence: number;
  #assetSequence: number;

  public constructor(params?: InMemoryItsmItOpsAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#incidents = [...(params?.seed?.incidents ?? [])];
    this.#changeRequests = [...(params?.seed?.changeRequests ?? [])];
    this.#assets = [...(params?.seed?.assets ?? [])];
    this.#cmdbItems = [...(params?.seed?.cmdbItems ?? [])];
    this.#problems = [...(params?.seed?.problems ?? [])];
    this.#serviceRequests = [...(params?.seed?.serviceRequests ?? [])];
    this.#incidentSequence = this.#incidents.length;
    this.#changeSequence = this.#changeRequests.length;
    this.#problemSequence = this.#problems.length;
    this.#assetSequence = this.#assets.length + this.#cmdbItems.length;
  }

  public async execute(input: ItsmItOpsExecuteInputV1): Promise<ItsmItOpsExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported ItsmItOps operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listIncidents':
        return { ok: true, result: { kind: 'tickets', tickets: this.#listIncidents(input) } };
      case 'getIncident':
        return this.#getIncident(input);
      case 'createIncident':
        return this.#createIncident(input);
      case 'updateIncident':
        return this.#updateIncident(input);
      case 'resolveIncident':
        return this.#resolveIncident(input);
      case 'listChangeRequests':
        return {
          ok: true,
          result: { kind: 'tickets', tickets: this.#listChangeRequests(input) },
        };
      case 'createChangeRequest':
        return this.#createChangeRequest(input);
      case 'approveChangeRequest':
        return this.#approveChangeRequest(input);
      case 'listAssets':
        return { ok: true, result: { kind: 'assets', assets: this.#listAssets(input) } };
      case 'getAsset':
        return this.#getAsset(input);
      case 'createAsset':
        return this.#createAsset(input);
      case 'updateAsset':
        return this.#updateAsset(input);
      case 'listCMDBItems':
        return { ok: true, result: { kind: 'assets', assets: this.#listCmdbItems(input) } };
      case 'getCMDBItem':
        return this.#getCmdbItem(input);
      case 'listProblems':
        return { ok: true, result: { kind: 'tickets', tickets: this.#listProblems(input) } };
      case 'createProblem':
        return this.#createProblem(input);
      case 'listServiceRequests':
        return {
          ok: true,
          result: { kind: 'tickets', tickets: this.#listServiceRequests(input) },
        };
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported ItsmItOps operation: ${String(input.operation)}.`,
        };
    }
  }

  #listIncidents(input: ItsmItOpsExecuteInputV1): readonly TicketV1[] {
    return this.#incidents.filter((ticket) => ticket.tenantId === input.tenantId);
  }

  #getIncident(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return { ok: false, error: 'validation_error', message: 'ticketId is required for getIncident.' };
    }
    const ticket = this.#incidents.find((item) => item.tenantId === input.tenantId && item.ticketId === ticketId);
    if (ticket === undefined) {
      return { ok: false, error: 'not_found', message: `Incident ${ticketId} was not found.` };
    }
    return { ok: true, result: { kind: 'ticket', ticket } };
  }

  #createIncident(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const subject = readString(input.payload, 'subject');
    if (subject === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'subject is required for createIncident.',
      };
    }

    const ticket: TicketV1 = {
      ticketId: TicketId(`incident-${++this.#incidentSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      subject,
      status: readTicketStatus(input.payload, 'status') ?? 'open',
      ...(readTicketPriority(input.payload, 'priority') !== null
        ? { priority: readTicketPriority(input.payload, 'priority')! }
        : {}),
      ...(typeof input.payload?.['assigneeId'] === 'string'
        ? { assigneeId: input.payload['assigneeId'] as string }
        : {}),
      createdAtIso: this.#now().toISOString(),
    };
    this.#incidents.push(ticket);
    return { ok: true, result: { kind: 'ticket', ticket } };
  }

  #updateIncident(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for updateIncident.',
      };
    }

    const index = this.#incidents.findIndex(
      (ticket) => ticket.tenantId === input.tenantId && ticket.ticketId === ticketId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Incident ${ticketId} was not found.` };
    }

    const statusValue = input.payload?.['status'];
    if (statusValue !== undefined && readTicketStatus(input.payload, 'status') === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'status must be one of: open, pending, resolved, closed.',
      };
    }
    const priorityValue = input.payload?.['priority'];
    if (priorityValue !== undefined && readTicketPriority(input.payload, 'priority') === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'priority must be one of: low, medium, high, urgent.',
      };
    }

    const updated: TicketV1 = {
      ...this.#incidents[index]!,
      ...(typeof input.payload?.['subject'] === 'string' ? { subject: input.payload['subject'] as string } : {}),
      ...(readTicketStatus(input.payload, 'status') !== null
        ? { status: readTicketStatus(input.payload, 'status')! }
        : {}),
      ...(readTicketPriority(input.payload, 'priority') !== null
        ? { priority: readTicketPriority(input.payload, 'priority')! }
        : {}),
      ...(typeof input.payload?.['assigneeId'] === 'string'
        ? { assigneeId: input.payload['assigneeId'] as string }
        : {}),
    };
    this.#incidents[index] = updated;
    return { ok: true, result: { kind: 'ticket', ticket: updated } };
  }

  #resolveIncident(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for resolveIncident.',
      };
    }

    const index = this.#incidents.findIndex(
      (ticket) => ticket.tenantId === input.tenantId && ticket.ticketId === ticketId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Incident ${ticketId} was not found.` };
    }
    const resolved: TicketV1 = { ...this.#incidents[index]!, status: 'resolved' };
    this.#incidents[index] = resolved;
    return { ok: true, result: { kind: 'ticket', ticket: resolved } };
  }

  #listChangeRequests(input: ItsmItOpsExecuteInputV1): readonly TicketV1[] {
    return this.#changeRequests.filter((ticket) => ticket.tenantId === input.tenantId);
  }

  #createChangeRequest(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const subject = readString(input.payload, 'subject');
    if (subject === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'subject is required for createChangeRequest.',
      };
    }

    const changeRequest: TicketV1 = {
      ticketId: TicketId(`change-${++this.#changeSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      subject,
      status: 'open',
      ...(readTicketPriority(input.payload, 'priority') !== null
        ? { priority: readTicketPriority(input.payload, 'priority')! }
        : {}),
      createdAtIso: this.#now().toISOString(),
    };
    this.#changeRequests.push(changeRequest);
    return { ok: true, result: { kind: 'ticket', ticket: changeRequest } };
  }

  #approveChangeRequest(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for approveChangeRequest.',
      };
    }
    const decision = readString(input.payload, 'decision');
    if (decision === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'decision is required for approveChangeRequest.',
      };
    }

    const index = this.#changeRequests.findIndex(
      (ticket) => ticket.tenantId === input.tenantId && ticket.ticketId === ticketId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Change request ${ticketId} was not found.` };
    }
    const approved = decision === 'approve' || decision === 'approved';
    const next: TicketV1 = {
      ...this.#changeRequests[index]!,
      status: approved ? 'resolved' : 'closed',
    };
    this.#changeRequests[index] = next;
    return { ok: true, result: { kind: 'ticket', ticket: next } };
  }

  #listAssets(input: ItsmItOpsExecuteInputV1): readonly AssetV1[] {
    return this.#assets.filter((asset) => asset.tenantId === input.tenantId);
  }

  #getAsset(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const assetId = readString(input.payload, 'assetId');
    if (assetId === null) {
      return { ok: false, error: 'validation_error', message: 'assetId is required for getAsset.' };
    }
    const asset = this.#assets.find((item) => item.tenantId === input.tenantId && item.assetId === assetId);
    if (asset === undefined) {
      return { ok: false, error: 'not_found', message: `Asset ${assetId} was not found.` };
    }
    return { ok: true, result: { kind: 'asset', asset } };
  }

  #createAsset(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createAsset.',
      };
    }

    const asset: AssetV1 = {
      assetId: AssetId(`asset-${++this.#assetSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      name,
      assetType: readString(input.payload, 'assetType') ?? 'server',
      ...(readString(input.payload, 'serialNumber') !== null
        ? { serialNumber: readString(input.payload, 'serialNumber')! }
        : {}),
      status: readAssetStatus(input.payload, 'status') ?? 'active',
    };
    this.#assets.push(asset);
    return { ok: true, result: { kind: 'asset', asset } };
  }

  #updateAsset(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const assetId = readString(input.payload, 'assetId');
    if (assetId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'assetId is required for updateAsset.',
      };
    }

    const index = this.#assets.findIndex(
      (asset) => asset.tenantId === input.tenantId && asset.assetId === assetId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Asset ${assetId} was not found.` };
    }

    const statusValue = input.payload?.['status'];
    if (statusValue !== undefined && readAssetStatus(input.payload, 'status') === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'status must be one of: active, inactive, retired, maintenance.',
      };
    }

    const updated: AssetV1 = {
      ...this.#assets[index]!,
      ...(typeof input.payload?.['name'] === 'string' ? { name: input.payload['name'] as string } : {}),
      ...(typeof input.payload?.['assetType'] === 'string'
        ? { assetType: input.payload['assetType'] as string }
        : {}),
      ...(typeof input.payload?.['serialNumber'] === 'string'
        ? { serialNumber: input.payload['serialNumber'] as string }
        : {}),
      ...(readAssetStatus(input.payload, 'status') !== null
        ? { status: readAssetStatus(input.payload, 'status')! }
        : {}),
    };
    this.#assets[index] = updated;
    return { ok: true, result: { kind: 'asset', asset: updated } };
  }

  #listCmdbItems(input: ItsmItOpsExecuteInputV1): readonly AssetV1[] {
    return this.#cmdbItems.filter((asset) => asset.tenantId === input.tenantId);
  }

  #getCmdbItem(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const assetId = readString(input.payload, 'assetId');
    if (assetId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'assetId is required for getCMDBItem.',
      };
    }
    const cmdbItem = this.#cmdbItems.find((item) => item.tenantId === input.tenantId && item.assetId === assetId);
    if (cmdbItem === undefined) {
      return { ok: false, error: 'not_found', message: `CMDB item ${assetId} was not found.` };
    }
    return { ok: true, result: { kind: 'asset', asset: cmdbItem } };
  }

  #listProblems(input: ItsmItOpsExecuteInputV1): readonly TicketV1[] {
    return this.#problems.filter((ticket) => ticket.tenantId === input.tenantId);
  }

  #createProblem(input: ItsmItOpsExecuteInputV1): ItsmItOpsExecuteOutputV1 {
    const subject = readString(input.payload, 'subject');
    if (subject === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'subject is required for createProblem.',
      };
    }

    const problem: TicketV1 = {
      ticketId: TicketId(`problem-${++this.#problemSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      subject,
      status: 'open',
      ...(readTicketPriority(input.payload, 'priority') !== null
        ? { priority: readTicketPriority(input.payload, 'priority')! }
        : {}),
      createdAtIso: this.#now().toISOString(),
    };
    this.#problems.push(problem);
    return { ok: true, result: { kind: 'ticket', ticket: problem } };
  }

  #listServiceRequests(input: ItsmItOpsExecuteInputV1): readonly TicketV1[] {
    return this.#serviceRequests.filter((ticket) => ticket.tenantId === input.tenantId);
  }

  public static seedMinimal(tenantId: ItsmItOpsExecuteInputV1['tenantId']): InMemoryItsmItOpsAdapterSeed {
    return {
      incidents: [
        {
          ticketId: TicketId('incident-1000'),
          tenantId,
          schemaVersion: 1,
          subject: 'VPN access unavailable',
          status: 'open',
          priority: 'high',
          createdAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
      changeRequests: [
        {
          ticketId: TicketId('change-1000'),
          tenantId,
          schemaVersion: 1,
          subject: 'Deploy firewall policy update',
          status: 'open',
          priority: 'medium',
          createdAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
      assets: [
        {
          assetId: AssetId('asset-1000'),
          tenantId,
          schemaVersion: 1,
          name: 'edge-router-01',
          assetType: 'network_device',
          status: 'active',
        },
      ],
      cmdbItems: [
        {
          assetId: AssetId('cmdb-1000'),
          tenantId,
          schemaVersion: 1,
          name: 'payments-api-service',
          assetType: 'service',
          status: 'active',
        },
      ],
      problems: [
        {
          ticketId: TicketId('problem-1000'),
          tenantId,
          schemaVersion: 1,
          subject: 'Recurring database failovers',
          status: 'pending',
          priority: 'high',
          createdAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
      serviceRequests: [
        {
          ticketId: TicketId('sr-1000'),
          tenantId,
          schemaVersion: 1,
          subject: 'Request access to BI dashboard',
          status: 'open',
          priority: 'low',
          createdAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
  }
}
