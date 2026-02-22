/**
 * Contact and segment (list) operations for the Mautic adapter.
 *
 * These standalone functions accept a MauticHttp client and the operation
 * input so they can be tested without constructing the full adapter class.
 */

import type {
  MarketingAutomationExecuteInputV1,
  MarketingAutomationExecuteOutputV1,
} from '../../../application/ports/marketing-automation-adapter.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import { makeExternalRef, mapMauticContactToParty, strOf } from './mautic-adapter-helpers.js';
import type { MauticHttp } from './mautic-adapter-helpers.js';

type Out = MarketingAutomationExecuteOutputV1;
type In = MarketingAutomationExecuteInputV1;

// ── Contacts ─────────────────────────────────────────────────────────────────

export async function listContacts(http: MauticHttp, input: In): Promise<Out> {
  const data = await http.get<{ contacts: Record<string, Record<string, unknown>> }>('contacts');
  const parties = Object.values(data.data.contacts).map((c) =>
    mapMauticContactToParty(c, String(input.tenantId)),
  );
  return { ok: true, result: { kind: 'parties', parties } };
}

export async function getContact(http: MauticHttp, input: In): Promise<Out> {
  const contactId = strOf(input.payload?.['contactId']);
  if (!contactId)
    return { ok: false, error: 'validation_error', message: 'contactId is required.' };

  const data = await http.get<{ contact: Record<string, unknown> }>(`contacts/${contactId}`);
  if (!data.data.contact)
    return { ok: false, error: 'not_found', message: `Contact ${contactId} not found.` };

  return {
    ok: true,
    result: {
      kind: 'party',
      party: mapMauticContactToParty(data.data.contact, String(input.tenantId)),
    },
  };
}

export async function createContact(http: MauticHttp, input: In): Promise<Out> {
  const displayName = strOf(input.payload?.['displayName']);
  if (!displayName)
    return { ok: false, error: 'validation_error', message: 'displayName is required.' };

  const [firstname, ...rest] = displayName.split(' ');
  const body: Record<string, string> = {
    firstname: firstname ?? displayName,
    lastname: rest.join(' '),
  };
  if (typeof input.payload?.['email'] === 'string') body['email'] = input.payload['email'];

  const data = await http.post<{ contact: Record<string, unknown> }>('contacts/new', body);
  return {
    ok: true,
    result: {
      kind: 'party',
      party: mapMauticContactToParty(data.data.contact, String(input.tenantId)),
    },
  };
}

export async function updateContact(http: MauticHttp, input: In): Promise<Out> {
  const contactId = strOf(input.payload?.['contactId']);
  if (!contactId)
    return { ok: false, error: 'validation_error', message: 'contactId is required.' };

  const body: Record<string, string> = {};
  if (typeof input.payload?.['displayName'] === 'string') {
    const [f, ...r] = input.payload['displayName'].split(' ');
    body['firstname'] = f ?? '';
    body['lastname'] = r.join(' ');
  }
  if (typeof input.payload?.['email'] === 'string') body['email'] = input.payload['email'];

  const data = await http.patch<{ contact: Record<string, unknown> }>(
    `contacts/${contactId}/edit`,
    body,
  );
  return {
    ok: true,
    result: {
      kind: 'party',
      party: mapMauticContactToParty(data.data.contact, String(input.tenantId)),
    },
  };
}

// ── Segments (Lists) ──────────────────────────────────────────────────────────

export async function listSegments(http: MauticHttp, _input: In): Promise<Out> {
  const data = await http.get<{ lists: Record<string, Record<string, unknown>> }>('segments');
  const refs: ExternalObjectRef[] = Object.values(data.data.lists).map((seg) =>
    makeExternalRef(
      strOf(seg['id']),
      'segment',
      strOf(seg['name']),
      `${http.baseUrl}/s/segments/${strOf(seg['id'])}`,
    ),
  );
  return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
}

export async function getSegment(http: MauticHttp, input: In): Promise<Out> {
  const listId = strOf(input.payload?.['listId']);
  if (!listId) return { ok: false, error: 'validation_error', message: 'listId is required.' };

  const data = await http.get<{ list: Record<string, unknown> }>(`segments/${listId}`);
  if (!data.data.list)
    return { ok: false, error: 'not_found', message: `Segment ${listId} not found.` };

  return {
    ok: true,
    result: {
      kind: 'externalRef',
      externalRef: makeExternalRef(
        strOf(data.data.list['id']),
        'segment',
        strOf(data.data.list['name']),
        `${http.baseUrl}/s/segments/${strOf(data.data.list['id'])}`,
      ),
    },
  };
}

export async function addContactToSegment(http: MauticHttp, input: In): Promise<Out> {
  const listId = strOf(input.payload?.['listId']);
  const contactId = strOf(input.payload?.['contactId']);
  if (!listId || !contactId)
    return {
      ok: false,
      error: 'validation_error',
      message: 'listId and contactId are required.',
    };

  await http.post(`segments/${listId}/contact/${contactId}/add`, {});
  return { ok: true, result: { kind: 'accepted', operation: input.operation } };
}

export async function removeContactFromSegment(http: MauticHttp, input: In): Promise<Out> {
  const listId = strOf(input.payload?.['listId']);
  const contactId = strOf(input.payload?.['contactId']);
  if (!listId || !contactId)
    return {
      ok: false,
      error: 'validation_error',
      message: 'listId and contactId are required.',
    };

  await http.post(`segments/${listId}/contact/${contactId}/remove`, {});
  return { ok: true, result: { kind: 'accepted', operation: input.operation } };
}
