import type { DocumentV1 } from '../../../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../../../domain/canonical/external-object-ref.js';
import type { OpportunityV1 } from '../../../../domain/canonical/opportunity-v1.js';
import type { PartyV1 } from '../../../../domain/canonical/party-v1.js';
import type { CanonicalTaskV1 } from '../../../../domain/canonical/task-v1.js';
import type { TenantId } from '../../../../domain/primitives/index.js';
import {
  CanonicalTaskId,
  DocumentId,
  OpportunityId,
  PartyId,
} from '../../../../domain/primitives/index.js';

const SOR_NAME = 'Salesforce';
const PORT_FAMILY = 'CrmSales' as const;

// ---- Salesforce record shapes (raw REST API response) ----

type SalesforceAttributes = Readonly<{ type: string; url: string }>;

export type SalesforceContact = Readonly<{
  attributes?: SalesforceAttributes;
  Id: string;
  Name?: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  AccountId?: string;
}>;

export type SalesforceAccount = Readonly<{
  attributes?: SalesforceAttributes;
  Id: string;
  Name: string;
  Phone?: string;
  Website?: string;
}>;

export type SalesforceOpportunity = Readonly<{
  attributes?: SalesforceAttributes;
  Id: string;
  Name: string;
  StageName: string;
  Amount?: number | null;
  CurrencyIsoCode?: string;
  CloseDate?: string;
  Probability?: number | null;
  AccountId?: string;
}>;

export type SalesforceTask = Readonly<{
  attributes?: SalesforceAttributes;
  Id: string;
  Subject: string;
  Status: string;
  OwnerId?: string;
  ActivityDate?: string;
}>;

export type SalesforceContentNote = Readonly<{
  attributes?: SalesforceAttributes;
  Id: string;
  Title: string;
  FileType?: string;
  ContentSize?: number;
  CreatedDate: string;
}>;

// ---- Mappers ----

function sfRef(externalId: string, externalType: string, displayLabel?: string): ExternalObjectRef {
  return {
    sorName: SOR_NAME,
    portFamily: PORT_FAMILY,
    externalId,
    externalType,
    ...(displayLabel ? { displayLabel } : {}),
  };
}

export function mapContact(tenantId: TenantId, record: SalesforceContact): PartyV1 {
  const displayName =
    record.Name ?? [record.FirstName, record.LastName].filter(Boolean).join(' ') ?? record.Id;

  return {
    partyId: PartyId(record.Id),
    tenantId,
    schemaVersion: 1,
    displayName,
    ...(record.Email ? { email: record.Email } : {}),
    ...(record.Phone ? { phone: record.Phone } : {}),
    roles: ['contact'],
    externalRefs: [sfRef(record.Id, 'Contact', displayName)],
  };
}

export function mapAccount(tenantId: TenantId, record: SalesforceAccount): PartyV1 {
  return {
    partyId: PartyId(record.Id),
    tenantId,
    schemaVersion: 1,
    displayName: record.Name,
    ...(record.Phone ? { phone: record.Phone } : {}),
    roles: ['org'],
    externalRefs: [sfRef(record.Id, 'Account', record.Name)],
  };
}

export function mapOpportunity(tenantId: TenantId, record: SalesforceOpportunity): OpportunityV1 {
  return {
    opportunityId: OpportunityId(record.Id),
    tenantId,
    schemaVersion: 1,
    name: record.Name,
    stage: record.StageName,
    ...(record.Amount != null ? { amount: record.Amount } : {}),
    ...(record.CurrencyIsoCode ? { currencyCode: record.CurrencyIsoCode } : {}),
    ...(record.CloseDate ? { closeDate: record.CloseDate } : {}),
    ...(record.Probability != null ? { probability: record.Probability } : {}),
    externalRefs: [sfRef(record.Id, 'Opportunity', record.Name)],
  };
}

const SF_TASK_STATUS_MAP: Record<string, 'todo' | 'in_progress' | 'done' | 'cancelled'> = {
  'Not Started': 'todo',
  'In Progress': 'in_progress',
  Completed: 'done',
  'Waiting on someone else': 'in_progress',
  Deferred: 'cancelled',
};

export function mapTask(tenantId: TenantId, record: SalesforceTask): CanonicalTaskV1 {
  return {
    canonicalTaskId: CanonicalTaskId(record.Id),
    tenantId,
    schemaVersion: 1,
    title: record.Subject,
    status: SF_TASK_STATUS_MAP[record.Status] ?? 'todo',
    ...(record.OwnerId ? { assigneeId: record.OwnerId } : {}),
    ...(record.ActivityDate ? { dueAtIso: record.ActivityDate } : {}),
    externalRefs: [sfRef(record.Id, 'Task', record.Subject)],
  };
}

export function mapContentNote(tenantId: TenantId, record: SalesforceContentNote): DocumentV1 {
  return {
    documentId: DocumentId(record.Id),
    tenantId,
    schemaVersion: 1,
    title: record.Title,
    mimeType: record.FileType === 'SNOTE' ? 'text/html' : 'application/octet-stream',
    ...(record.ContentSize != null ? { sizeBytes: record.ContentSize } : {}),
    createdAtIso: record.CreatedDate,
    externalRefs: [sfRef(record.Id, 'ContentNote', record.Title)],
  };
}

// ---- Reverse mappers (canonical → Salesforce create payloads) ----

export function toSalesforceContactPayload(
  payload: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (typeof payload['displayName'] === 'string') {
    result['LastName'] = payload['displayName'];
  }
  if (typeof payload['email'] === 'string') result['Email'] = payload['email'];
  if (typeof payload['phone'] === 'string') result['Phone'] = payload['phone'];
  return result;
}

export function toSalesforceAccountPayload(
  payload: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (typeof payload['displayName'] === 'string') result['Name'] = payload['displayName'];
  if (typeof payload['phone'] === 'string') result['Phone'] = payload['phone'];
  return result;
}

export function toSalesforceOpportunityPayload(
  payload: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (typeof payload['name'] === 'string') result['Name'] = payload['name'];
  if (typeof payload['stage'] === 'string') result['StageName'] = payload['stage'];
  if (typeof payload['amount'] === 'number') result['Amount'] = payload['amount'];
  if (typeof payload['currencyCode'] === 'string')
    result['CurrencyIsoCode'] = payload['currencyCode'];
  if (typeof payload['closeDate'] === 'string') result['CloseDate'] = payload['closeDate'];
  return result;
}

export function toSalesforceTaskPayload(
  payload: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (typeof payload['title'] === 'string') result['Subject'] = payload['title'];
  if (typeof payload['status'] === 'string') {
    const reverseMap: Record<string, string> = {
      todo: 'Not Started',
      in_progress: 'In Progress',
      done: 'Completed',
      cancelled: 'Deferred',
    };
    result['Status'] = reverseMap[payload['status']] ?? 'Not Started';
  }
  if (typeof payload['assigneeId'] === 'string') result['OwnerId'] = payload['assigneeId'];
  return result;
}
