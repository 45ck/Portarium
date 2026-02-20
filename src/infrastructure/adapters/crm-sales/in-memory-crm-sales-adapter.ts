import type { DocumentV1 } from '../../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { OpportunityV1 } from '../../../domain/canonical/opportunity-v1.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import type { CanonicalTaskV1 } from '../../../domain/canonical/task-v1.js';
import {
  CanonicalTaskId,
  DocumentId,
  OpportunityId,
  PartyId,
} from '../../../domain/primitives/index.js';
import type {
  CrmSalesAdapterPort,
  CrmSalesExecuteInputV1,
  CrmSalesExecuteOutputV1,
} from '../../../application/ports/crm-sales-adapter.js';
import { CRM_SALES_OPERATIONS_V1 } from '../../../application/ports/crm-sales-adapter.js';

const OPERATION_SET = new Set<string>(CRM_SALES_OPERATIONS_V1);
const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

type TenantExternalRef = Readonly<{
  tenantId: CrmSalesExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type InMemoryCrmSalesAdapterSeed = Readonly<{
  contacts?: readonly PartyV1[];
  companies?: readonly PartyV1[];
  opportunities?: readonly OpportunityV1[];
  pipelines?: readonly TenantExternalRef[];
  activities?: readonly CanonicalTaskV1[];
  notes?: readonly DocumentV1[];
}>;

type InMemoryCrmSalesAdapterParams = Readonly<{
  seed?: InMemoryCrmSalesAdapterSeed;
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

function readTaskStatus(payload: Readonly<Record<string, unknown>> | undefined): TaskStatus | null {
  const status = payload?.['status'];
  if (typeof status !== 'string') return null;
  return TASK_STATUSES.includes(status as TaskStatus) ? (status as TaskStatus) : null;
}

export class InMemoryCrmSalesAdapter implements CrmSalesAdapterPort {
  readonly #now: () => Date;
  readonly #contacts: PartyV1[];
  readonly #companies: PartyV1[];
  readonly #opportunities: OpportunityV1[];
  readonly #pipelines: TenantExternalRef[];
  readonly #activities: CanonicalTaskV1[];
  readonly #notes: DocumentV1[];
  #contactSequence: number;
  #companySequence: number;
  #opportunitySequence: number;
  #activitySequence: number;
  #noteSequence: number;

  public constructor(params?: InMemoryCrmSalesAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#contacts = [...(params?.seed?.contacts ?? [])];
    this.#companies = [...(params?.seed?.companies ?? [])];
    this.#opportunities = [...(params?.seed?.opportunities ?? [])];
    this.#pipelines = [...(params?.seed?.pipelines ?? [])];
    this.#activities = [...(params?.seed?.activities ?? [])];
    this.#notes = [...(params?.seed?.notes ?? [])];
    this.#contactSequence = this.#contacts.length;
    this.#companySequence = this.#companies.length;
    this.#opportunitySequence = this.#opportunities.length;
    this.#activitySequence = this.#activities.length;
    this.#noteSequence = this.#notes.length;
  }

  public async execute(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported CrmSales operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listContacts':
        return { ok: true, result: { kind: 'parties', parties: this.#listContacts(input) } };
      case 'getContact':
        return this.#getContact(input);
      case 'createContact':
        return this.#createContact(input);
      case 'updateContact':
        return this.#updateContact(input);
      case 'listCompanies':
        return { ok: true, result: { kind: 'parties', parties: this.#listCompanies(input) } };
      case 'getCompany':
        return this.#getCompany(input);
      case 'createCompany':
        return this.#createCompany(input);
      case 'listOpportunities':
        return {
          ok: true,
          result: { kind: 'opportunities', opportunities: this.#listOpportunities(input) },
        };
      case 'getOpportunity':
        return this.#getOpportunity(input);
      case 'createOpportunity':
        return this.#createOpportunity(input);
      case 'updateOpportunityStage':
        return this.#updateOpportunityStage(input);
      case 'listPipelines':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listPipelines(input) },
        };
      case 'listActivities':
        return { ok: true, result: { kind: 'tasks', tasks: this.#listActivities(input) } };
      case 'createActivity':
        return this.#createActivity(input);
      case 'listNotes':
        return { ok: true, result: { kind: 'documents', documents: this.#listNotes(input) } };
      case 'createNote':
        return this.#createNote(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported CrmSales operation: ${String(input.operation)}.`,
        };
    }
  }

  #listContacts(input: CrmSalesExecuteInputV1): readonly PartyV1[] {
    return this.#contacts.filter((contact) => contact.tenantId === input.tenantId);
  }

  #getContact(input: CrmSalesExecuteInputV1): CrmSalesExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return { ok: false, error: 'validation_error', message: 'partyId is required for getContact.' };
    }
    const contact = this.#contacts.find((item) => item.tenantId === input.tenantId && item.partyId === partyId);
    if (contact === undefined) {
      return { ok: false, error: 'not_found', message: `Contact ${partyId} was not found.` };
    }
    return { ok: true, result: { kind: 'party', party: contact } };
  }

  #createContact(input: CrmSalesExecuteInputV1): CrmSalesExecuteOutputV1 {
    const displayName = readString(input.payload, 'displayName');
    if (displayName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'displayName is required for createContact.',
      };
    }
    const contact: PartyV1 = {
      partyId: PartyId(`contact-${++this.#contactSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      displayName,
      roles: ['contact'],
      ...(typeof input.payload?.['email'] === 'string' ? { email: input.payload['email'] } : {}),
      ...(typeof input.payload?.['phone'] === 'string' ? { phone: input.payload['phone'] } : {}),
    };
    this.#contacts.push(contact);
    return { ok: true, result: { kind: 'party', party: contact } };
  }

  #updateContact(input: CrmSalesExecuteInputV1): CrmSalesExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'partyId is required for updateContact.',
      };
    }
    const index = this.#contacts.findIndex(
      (item) => item.tenantId === input.tenantId && item.partyId === partyId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Contact ${partyId} was not found.` };
    }
    const current = this.#contacts[index]!;
    const next: PartyV1 = {
      ...current,
      ...(typeof input.payload?.['displayName'] === 'string'
        ? { displayName: input.payload['displayName'] }
        : {}),
      ...(typeof input.payload?.['email'] === 'string' ? { email: input.payload['email'] } : {}),
      ...(typeof input.payload?.['phone'] === 'string' ? { phone: input.payload['phone'] } : {}),
    };
    this.#contacts[index] = next;
    return { ok: true, result: { kind: 'party', party: next } };
  }

  #listCompanies(input: CrmSalesExecuteInputV1): readonly PartyV1[] {
    return this.#companies.filter((company) => company.tenantId === input.tenantId);
  }

  #getCompany(input: CrmSalesExecuteInputV1): CrmSalesExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return { ok: false, error: 'validation_error', message: 'partyId is required for getCompany.' };
    }
    const company = this.#companies.find((item) => item.tenantId === input.tenantId && item.partyId === partyId);
    if (company === undefined) {
      return { ok: false, error: 'not_found', message: `Company ${partyId} was not found.` };
    }
    return { ok: true, result: { kind: 'party', party: company } };
  }

  #createCompany(input: CrmSalesExecuteInputV1): CrmSalesExecuteOutputV1 {
    const displayName = readString(input.payload, 'displayName');
    if (displayName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'displayName is required for createCompany.',
      };
    }
    const company: PartyV1 = {
      partyId: PartyId(`company-${++this.#companySequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      displayName,
      roles: ['org'],
      ...(typeof input.payload?.['email'] === 'string' ? { email: input.payload['email'] } : {}),
      ...(typeof input.payload?.['phone'] === 'string' ? { phone: input.payload['phone'] } : {}),
    };
    this.#companies.push(company);
    return { ok: true, result: { kind: 'party', party: company } };
  }

  #listOpportunities(input: CrmSalesExecuteInputV1): readonly OpportunityV1[] {
    return this.#opportunities.filter((opportunity) => opportunity.tenantId === input.tenantId);
  }

  #getOpportunity(input: CrmSalesExecuteInputV1): CrmSalesExecuteOutputV1 {
    const opportunityId = readString(input.payload, 'opportunityId');
    if (opportunityId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'opportunityId is required for getOpportunity.',
      };
    }
    const opportunity = this.#opportunities.find(
      (item) => item.tenantId === input.tenantId && item.opportunityId === opportunityId,
    );
    if (opportunity === undefined) {
      return { ok: false, error: 'not_found', message: `Opportunity ${opportunityId} was not found.` };
    }
    return { ok: true, result: { kind: 'opportunity', opportunity } };
  }

  #createOpportunity(input: CrmSalesExecuteInputV1): CrmSalesExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createOpportunity.',
      };
    }
    const amount = readNumber(input.payload, 'amount');
    if (amount !== null && amount < 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'amount must be a non-negative number for createOpportunity.',
      };
    }

    const opportunity: OpportunityV1 = {
      opportunityId: OpportunityId(`opportunity-${++this.#opportunitySequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      name,
      stage:
        (typeof input.payload?.['stage'] === 'string'
          ? input.payload['stage']
          : 'qualification'),
      ...(amount !== null ? { amount } : {}),
      ...(typeof input.payload?.['currencyCode'] === 'string'
        ? { currencyCode: input.payload['currencyCode'] }
        : {}),
    };
    this.#opportunities.push(opportunity);
    return { ok: true, result: { kind: 'opportunity', opportunity } };
  }

  #updateOpportunityStage(input: CrmSalesExecuteInputV1): CrmSalesExecuteOutputV1 {
    const opportunityId = readString(input.payload, 'opportunityId');
    if (opportunityId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'opportunityId is required for updateOpportunityStage.',
      };
    }
    const stage = readString(input.payload, 'stage');
    if (stage === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'stage is required for updateOpportunityStage.',
      };
    }
    const index = this.#opportunities.findIndex(
      (item) => item.tenantId === input.tenantId && item.opportunityId === opportunityId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Opportunity ${opportunityId} was not found.` };
    }
    const updated: OpportunityV1 = { ...this.#opportunities[index]!, stage };
    this.#opportunities[index] = updated;
    return { ok: true, result: { kind: 'opportunity', opportunity: updated } };
  }

  #listPipelines(input: CrmSalesExecuteInputV1): readonly ExternalObjectRef[] {
    return this.#pipelines
      .filter((pipeline) => pipeline.tenantId === input.tenantId)
      .map((pipeline) => pipeline.externalRef);
  }

  #listActivities(input: CrmSalesExecuteInputV1): readonly CanonicalTaskV1[] {
    return this.#activities.filter((activity) => activity.tenantId === input.tenantId);
  }

  #createActivity(input: CrmSalesExecuteInputV1): CrmSalesExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createActivity.',
      };
    }

    const task: CanonicalTaskV1 = {
      canonicalTaskId: CanonicalTaskId(`activity-${++this.#activitySequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      title,
      status: readTaskStatus(input.payload) ?? 'todo',
      ...(typeof input.payload?.['assigneeId'] === 'string'
        ? { assigneeId: input.payload['assigneeId'] }
        : {}),
    };
    this.#activities.push(task);
    return { ok: true, result: { kind: 'task', task } };
  }

  #listNotes(input: CrmSalesExecuteInputV1): readonly DocumentV1[] {
    return this.#notes.filter((note) => note.tenantId === input.tenantId);
  }

  #createNote(input: CrmSalesExecuteInputV1): CrmSalesExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createNote.',
      };
    }

    const sizeBytes = readNumber(input.payload, 'sizeBytes');
    if (sizeBytes !== null && sizeBytes < 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'sizeBytes must be a non-negative number for createNote.',
      };
    }

    const note: DocumentV1 = {
      documentId: DocumentId(`note-${++this.#noteSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      title,
      mimeType:
        (typeof input.payload?.['mimeType'] === 'string'
          ? input.payload['mimeType']
          : 'text/plain'),
      ...(sizeBytes !== null ? { sizeBytes } : {}),
      ...(typeof input.payload?.['storagePath'] === 'string'
        ? { storagePath: input.payload['storagePath'] }
        : {}),
      createdAtIso: this.#now().toISOString(),
    };
    this.#notes.push(note);
    return { ok: true, result: { kind: 'document', document: note } };
  }

  public static seedMinimal(tenantId: CrmSalesExecuteInputV1['tenantId']): InMemoryCrmSalesAdapterSeed {
    return {
      contacts: [
        {
          partyId: PartyId('contact-1000'),
          tenantId,
          schemaVersion: 1,
          displayName: 'Default Contact',
          email: 'contact@example.com',
          roles: ['contact'],
        },
      ],
      companies: [
        {
          partyId: PartyId('company-1000'),
          tenantId,
          schemaVersion: 1,
          displayName: 'Default Company',
          roles: ['org'],
        },
      ],
      opportunities: [
        {
          opportunityId: OpportunityId('opportunity-1000'),
          tenantId,
          schemaVersion: 1,
          name: 'Platform Expansion',
          stage: 'qualification',
          amount: 25000,
          currencyCode: 'USD',
        },
      ],
      pipelines: [
        {
          tenantId,
          externalRef: {
            sorName: 'CrmSuite',
            portFamily: 'CrmSales',
            externalId: 'pipeline-1000',
            externalType: 'pipeline',
            displayLabel: 'Default Pipeline',
          },
        },
      ],
      activities: [
        {
          canonicalTaskId: CanonicalTaskId('activity-1000'),
          tenantId,
          schemaVersion: 1,
          title: 'Follow up discovery call',
          status: 'todo',
        },
      ],
      notes: [
        {
          documentId: DocumentId('note-1000'),
          tenantId,
          schemaVersion: 1,
          title: 'Discovery Notes',
          mimeType: 'text/plain',
          createdAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
  }
}
