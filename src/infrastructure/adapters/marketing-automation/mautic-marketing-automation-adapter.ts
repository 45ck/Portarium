/**
 * Mautic reference adapter for the MarketingAutomation port family.
 *
 * Implements the `MarketingAutomationAdapterPort` against Mautic's REST API v1.
 * Mautic is an open-source marketing automation platform that supports:
 *   - Contact management (create, update, list, get)
 *   - Segment (list) membership
 *   - Email campaigns (create, schedule, send)
 *   - Automation workflows
 *   - Forms and form submissions
 *
 * Authentication: HTTP Basic Auth (username:password) per tenant.
 * Base URL example: https://mautic.example.com/api/
 *
 * All Mautic API references: https://developer.mautic.org/#rest-api
 *
 * Bead: bead-0421
 */

import type { CampaignV1 } from '../../../domain/canonical/campaign-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import { CampaignId, PartyId } from '../../../domain/primitives/index.js';
import type {
  MarketingAutomationAdapterPort,
  MarketingAutomationExecuteInputV1,
  MarketingAutomationExecuteOutputV1,
} from '../../../application/ports/marketing-automation-adapter.js';

// ── Config ────────────────────────────────────────────────────────────────

export interface MauticAdapterConfig {
  /** Base URL of the Mautic instance (e.g. https://mautic.example.com). */
  baseUrl: string;
  /** Mautic API username. */
  username: string;
  /** Mautic API password. */
  password: string;
  /** Optional request timeout in ms. Default: 10 000. */
  timeoutMs?: number;
}

// ── Internal HTTP helpers ─────────────────────────────────────────────────

type FetchFn = typeof fetch;

interface MauticResponse<T> {
  data: T;
  status: number;
}

// ── Mapper helpers ─────────────────────────────────────────────────────────

function mapMauticContactToParty(contact: Record<string, unknown>, tenantId: string): PartyV1 {
  const fields =
    (contact['fields'] as Record<string, Record<string, unknown>> | undefined)?.['all'] ?? {};
  return {
    partyId: PartyId(String(contact['id'] ?? '')),
    tenantId: tenantId as PartyV1['tenantId'],
    schemaVersion: 1,
    displayName:
      `${String(fields['firstname'] ?? '')} ${String(fields['lastname'] ?? '')}`.trim() ||
      String(fields['email'] ?? contact['id'] ?? ''),
    ...(typeof fields['email'] === 'string' ? { email: fields['email'] } : {}),
    roles: ['lead'],
  };
}

function mapMauticCampaignToCampaign(
  campaign: Record<string, unknown>,
  tenantId: string,
): CampaignV1 {
  return {
    campaignId: CampaignId(String(campaign['id'] ?? '')),
    tenantId: tenantId as CampaignV1['tenantId'],
    schemaVersion: 1,
    name: String(campaign['name'] ?? ''),
    status: campaign['isPublished'] ? 'active' : 'draft',
    channelType: 'email',
  };
}

function makeExternalRef(
  id: string | number,
  externalType: string,
  displayLabel: string,
  baseUrl: string,
  path: string,
): ExternalObjectRef {
  return {
    sorName: 'Mautic',
    portFamily: 'MarketingAutomation',
    externalId: String(id),
    externalType,
    displayLabel,
    deepLinkUrl: `${baseUrl}/${path}/${id}`,
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────

export class MauticMarketingAutomationAdapter implements MarketingAutomationAdapterPort {
  readonly #config: MauticAdapterConfig;
  readonly #fetch: FetchFn;
  readonly #authHeader: string;

  constructor(config: MauticAdapterConfig, fetchFn: FetchFn = fetch) {
    this.#config = config;
    this.#fetch = fetchFn;
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    this.#authHeader = `Basic ${credentials}`;
  }

  async execute(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    try {
      switch (input.operation) {
        case 'listContacts':
          return await this.#listContacts(input);
        case 'getContact':
          return await this.#getContact(input);
        case 'createContact':
          return await this.#createContact(input);
        case 'updateContact':
          return await this.#updateContact(input);
        case 'listLists':
          return await this.#listSegments(input);
        case 'getList':
          return await this.#getSegment(input);
        case 'addContactToList':
          return await this.#addContactToSegment(input);
        case 'removeContactFromList':
          return await this.#removeContactFromSegment(input);
        case 'listCampaigns':
          return await this.#listCampaigns(input);
        case 'getCampaign':
          return await this.#getCampaign(input);
        case 'createCampaign':
          return await this.#createCampaign(input);
        case 'sendCampaign':
          return await this.#sendCampaign(input);
        case 'getCampaignStats':
          return await this.#getCampaignStats(input);
        case 'listAutomations':
          return await this.#listCampaigns(input); // Mautic campaigns = automations
        case 'getAutomation':
          return await this.#getCampaign(input);
        case 'triggerAutomation':
          return await this.#triggerAutomation(input);
        case 'listForms':
          return await this.#listForms(input);
        case 'getFormSubmissions':
          return await this.#getFormSubmissions(input);
        default:
          return {
            ok: false,
            error: 'unsupported_operation',
            message: `Unsupported: ${String(input.operation)}`,
          };
      }
    } catch (err) {
      return {
        ok: false,
        error: 'provider_error',
        message: `Mautic API error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── Contacts ─────────────────────────────────────────────────────────────

  async #listContacts(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const data = await this.#get<{ contacts: Record<string, Record<string, unknown>> }>('contacts');
    const parties = Object.values(data.data.contacts).map((c) =>
      mapMauticContactToParty(c, String(input.tenantId)),
    );
    return { ok: true, result: { kind: 'parties', parties } };
  }

  async #getContact(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const contactId = String(input.payload?.['contactId'] ?? '');
    if (!contactId)
      return { ok: false, error: 'validation_error', message: 'contactId is required.' };

    const data = await this.#get<{ contact: Record<string, unknown> }>(`contacts/${contactId}`);
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

  async #createContact(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const displayName = String(input.payload?.['displayName'] ?? '');
    if (!displayName)
      return { ok: false, error: 'validation_error', message: 'displayName is required.' };

    const [firstname, ...rest] = displayName.split(' ');
    const body: Record<string, string> = {
      firstname: firstname ?? displayName,
      lastname: rest.join(' '),
    };
    if (typeof input.payload?.['email'] === 'string') body['email'] = input.payload['email'];

    const data = await this.#post<{ contact: Record<string, unknown> }>('contacts/new', body);
    return {
      ok: true,
      result: {
        kind: 'party',
        party: mapMauticContactToParty(data.data.contact, String(input.tenantId)),
      },
    };
  }

  async #updateContact(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const contactId = String(input.payload?.['contactId'] ?? '');
    if (!contactId)
      return { ok: false, error: 'validation_error', message: 'contactId is required.' };

    const body: Record<string, string> = {};
    if (typeof input.payload?.['displayName'] === 'string') {
      const [f, ...r] = (input.payload['displayName'] as string).split(' ');
      body['firstname'] = f ?? '';
      body['lastname'] = r.join(' ');
    }
    if (typeof input.payload?.['email'] === 'string') body['email'] = input.payload['email'];

    const data = await this.#patch<{ contact: Record<string, unknown> }>(
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

  // ── Segments (Lists) ───────────────────────────────────────────────────────

  async #listSegments(
    _input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const data = await this.#get<{ lists: Record<string, Record<string, unknown>> }>('segments');
    const refs: ExternalObjectRef[] = Object.values(data.data.lists).map((seg) =>
      makeExternalRef(
        seg['id'] as string,
        'segment',
        String(seg['name'] ?? ''),
        this.#config.baseUrl,
        's/segments',
      ),
    );
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }

  async #getSegment(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const listId = String(input.payload?.['listId'] ?? '');
    if (!listId) return { ok: false, error: 'validation_error', message: 'listId is required.' };

    const data = await this.#get<{ list: Record<string, unknown> }>(`segments/${listId}`);
    if (!data.data.list)
      return { ok: false, error: 'not_found', message: `Segment ${listId} not found.` };

    return {
      ok: true,
      result: {
        kind: 'externalRef',
        externalRef: makeExternalRef(
          data.data.list['id'] as string,
          'segment',
          String(data.data.list['name'] ?? ''),
          this.#config.baseUrl,
          's/segments',
        ),
      },
    };
  }

  async #addContactToSegment(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const listId = String(input.payload?.['listId'] ?? '');
    const contactId = String(input.payload?.['contactId'] ?? '');
    if (!listId || !contactId)
      return {
        ok: false,
        error: 'validation_error',
        message: 'listId and contactId are required.',
      };

    await this.#post(`segments/${listId}/contact/${contactId}/add`, {});
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  async #removeContactFromSegment(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const listId = String(input.payload?.['listId'] ?? '');
    const contactId = String(input.payload?.['contactId'] ?? '');
    if (!listId || !contactId)
      return {
        ok: false,
        error: 'validation_error',
        message: 'listId and contactId are required.',
      };

    await this.#post(`segments/${listId}/contact/${contactId}/remove`, {});
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  async #listCampaigns(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const data = await this.#get<{ campaigns: Record<string, Record<string, unknown>> }>(
      'campaigns',
    );
    const campaigns = Object.values(data.data.campaigns).map((c) =>
      mapMauticCampaignToCampaign(c, String(input.tenantId)),
    );
    return { ok: true, result: { kind: 'campaigns', campaigns } };
  }

  async #getCampaign(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const campaignId = String(
      input.payload?.['campaignId'] ?? input.payload?.['automationId'] ?? '',
    );
    if (!campaignId)
      return { ok: false, error: 'validation_error', message: 'campaignId is required.' };

    const data = await this.#get<{ campaign: Record<string, unknown> }>(`campaigns/${campaignId}`);
    if (!data.data.campaign)
      return { ok: false, error: 'not_found', message: `Campaign ${campaignId} not found.` };

    return {
      ok: true,
      result: {
        kind: 'campaign',
        campaign: mapMauticCampaignToCampaign(data.data.campaign, String(input.tenantId)),
      },
    };
  }

  async #createCampaign(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const name = String(input.payload?.['name'] ?? '');
    if (!name) return { ok: false, error: 'validation_error', message: 'name is required.' };

    const data = await this.#post<{ campaign: Record<string, unknown> }>('campaigns/new', {
      name,
      isPublished: false,
    });
    return {
      ok: true,
      result: {
        kind: 'campaign',
        campaign: mapMauticCampaignToCampaign(data.data.campaign, String(input.tenantId)),
      },
    };
  }

  async #sendCampaign(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const campaignId = String(input.payload?.['campaignId'] ?? '');
    if (!campaignId)
      return { ok: false, error: 'validation_error', message: 'campaignId is required.' };

    // Publish the campaign (Mautic uses isPublished to activate).
    const data = await this.#patch<{ campaign: Record<string, unknown> }>(
      `campaigns/${campaignId}/edit`,
      { isPublished: true },
    );
    return {
      ok: true,
      result: {
        kind: 'campaign',
        campaign: mapMauticCampaignToCampaign(data.data.campaign, String(input.tenantId)),
      },
    };
  }

  async #getCampaignStats(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const campaignId = String(input.payload?.['campaignId'] ?? '');
    if (!campaignId)
      return { ok: false, error: 'validation_error', message: 'campaignId is required.' };

    // Return as externalRef pointing to Mautic campaign stats page.
    return {
      ok: true,
      result: {
        kind: 'externalRef',
        externalRef: makeExternalRef(
          campaignId,
          'campaign_stats',
          `Campaign ${campaignId} stats`,
          this.#config.baseUrl,
          's/campaigns/view',
        ),
      },
    };
  }

  async #triggerAutomation(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const automationId = String(input.payload?.['automationId'] ?? '');
    const contactId = String(input.payload?.['contactId'] ?? '');
    if (!automationId)
      return { ok: false, error: 'validation_error', message: 'automationId is required.' };

    if (contactId) {
      await this.#post(`campaigns/${automationId}/contact/${contactId}/add`, {});
    }

    return {
      ok: true,
      result: {
        kind: 'externalRef',
        externalRef: makeExternalRef(
          `${automationId}-run-${Date.now()}`,
          'automation_run',
          `Automation ${automationId} triggered`,
          this.#config.baseUrl,
          's/campaigns/view',
        ),
      },
    };
  }

  // ── Forms ─────────────────────────────────────────────────────────────────

  async #listForms(
    _input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const data = await this.#get<{ forms: Record<string, Record<string, unknown>> }>('forms');
    const refs: ExternalObjectRef[] = Object.values(data.data.forms).map((f) =>
      makeExternalRef(
        f['id'] as string,
        'form',
        String(f['name'] ?? ''),
        this.#config.baseUrl,
        's/forms/view',
      ),
    );
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }

  async #getFormSubmissions(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    const formId = String(input.payload?.['formId'] ?? '');
    if (!formId) return { ok: false, error: 'validation_error', message: 'formId is required.' };

    const data = await this.#get<{ submissions: Record<string, Record<string, unknown>> }>(
      `forms/${formId}/submissions`,
    );
    const refs: ExternalObjectRef[] = Object.values(data.data.submissions ?? {}).map((s) =>
      makeExternalRef(
        s['id'] as string,
        'form_submission',
        `Submission #${s['id']}`,
        this.#config.baseUrl,
        's/forms/results',
      ),
    );
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }

  // ── HTTP primitives ────────────────────────────────────────────────────────

  async #get<T>(path: string): Promise<MauticResponse<T>> {
    return this.#request<T>('GET', path);
  }

  async #post<T>(path: string, body: unknown): Promise<MauticResponse<T>> {
    return this.#request<T>('POST', path, body);
  }

  async #patch<T>(path: string, body: unknown): Promise<MauticResponse<T>> {
    return this.#request<T>('PATCH', path, body);
  }

  async #request<T>(method: string, path: string, body?: unknown): Promise<MauticResponse<T>> {
    const url = `${this.#config.baseUrl}/api/${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs ?? 10_000);

    try {
      const res = await this.#fetch(url, {
        method,
        headers: {
          Authorization: this.#authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} from Mautic API (${path}): ${text}`);
      }

      const data = (await res.json()) as T;
      return { data, status: res.status };
    } finally {
      clearTimeout(timeout);
    }
  }
}
