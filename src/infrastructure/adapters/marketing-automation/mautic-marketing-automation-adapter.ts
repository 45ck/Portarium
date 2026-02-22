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

import type {
  MarketingAutomationAdapterPort,
  MarketingAutomationExecuteInputV1,
  MarketingAutomationExecuteOutputV1,
} from '../../../application/ports/marketing-automation-adapter.js';
import {
  type MauticAdapterConfig,
  type MauticHttp,
  createMauticHttp,
  makeExternalRef,
  mapMauticCampaignToCampaign,
  mauticProviderError,
  strOf,
} from './mautic-adapter-helpers.js';
import {
  addContactToSegment,
  createContact,
  getContact,
  getSegment,
  listContacts,
  listSegments,
  removeContactFromSegment,
  updateContact,
} from './mautic-contact-ops.js';

export type { MauticAdapterConfig };

type Out = MarketingAutomationExecuteOutputV1;
type In = MarketingAutomationExecuteInputV1;

// ── Adapter ───────────────────────────────────────────────────────────────

export class MauticMarketingAutomationAdapter implements MarketingAutomationAdapterPort {
  readonly #http: MauticHttp;

  constructor(config: MauticAdapterConfig, fetchFn: typeof fetch = fetch) {
    this.#http = createMauticHttp(config, fetchFn);
  }

  async execute(input: In): Promise<Out> {
    return this.#dispatch(input).catch(mauticProviderError);
  }

  async #dispatch(input: In): Promise<Out> {
    switch (input.operation) {
      case 'listContacts':
        return listContacts(this.#http, input);
      case 'getContact':
        return getContact(this.#http, input);
      case 'createContact':
        return createContact(this.#http, input);
      case 'updateContact':
        return updateContact(this.#http, input);
      case 'listLists':
        return listSegments(this.#http, input);
      case 'getList':
        return getSegment(this.#http, input);
      case 'addContactToList':
        return addContactToSegment(this.#http, input);
      case 'removeContactFromList':
        return removeContactFromSegment(this.#http, input);
      default:
        return this.#dispatchCampaigns(input);
    }
  }

  async #dispatchCampaigns(input: In): Promise<Out> {
    switch (input.operation) {
      case 'listCampaigns':
        return this.#listCampaigns(input);
      case 'getCampaign':
        return this.#getCampaign(input);
      case 'createCampaign':
        return this.#createCampaign(input);
      case 'sendCampaign':
        return this.#sendCampaign(input);
      case 'getCampaignStats':
        return this.#getCampaignStats(input);
      case 'listAutomations':
        return this.#listCampaigns(input); // Mautic campaigns = automations
      case 'getAutomation':
        return this.#getCampaign(input);
      case 'triggerAutomation':
        return this.#triggerAutomation(input);
      default:
        return this.#dispatchForms(input);
    }
  }

  async #dispatchForms(input: In): Promise<Out> {
    switch (input.operation) {
      case 'listForms':
        return this.#listForms(input);
      case 'getFormSubmissions':
        return this.#getFormSubmissions(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported: ${input.operation}`,
        };
    }
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  async #listCampaigns(input: In): Promise<Out> {
    const data = await this.#http.get<{ campaigns: Record<string, Record<string, unknown>> }>(
      'campaigns',
    );
    const campaigns = Object.values(data.data.campaigns).map((c) =>
      mapMauticCampaignToCampaign(c, String(input.tenantId)),
    );
    return { ok: true, result: { kind: 'campaigns', campaigns } };
  }

  async #getCampaign(input: In): Promise<Out> {
    const campaignId =
      strOf(input.payload?.['campaignId']) || strOf(input.payload?.['automationId']);
    if (!campaignId)
      return { ok: false, error: 'validation_error', message: 'campaignId is required.' };

    const data = await this.#http.get<{ campaign: Record<string, unknown> }>(
      `campaigns/${campaignId}`,
    );
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

  async #createCampaign(input: In): Promise<Out> {
    const name = strOf(input.payload?.['name']);
    if (!name) return { ok: false, error: 'validation_error', message: 'name is required.' };

    const data = await this.#http.post<{ campaign: Record<string, unknown> }>('campaigns/new', {
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

  async #sendCampaign(input: In): Promise<Out> {
    const campaignId = strOf(input.payload?.['campaignId']);
    if (!campaignId)
      return { ok: false, error: 'validation_error', message: 'campaignId is required.' };

    const data = await this.#http.patch<{ campaign: Record<string, unknown> }>(
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

  #getCampaignStats(input: In): Promise<Out> {
    const campaignId = strOf(input.payload?.['campaignId']);
    if (!campaignId)
      return Promise.resolve({
        ok: false,
        error: 'validation_error',
        message: 'campaignId is required.',
      });

    return Promise.resolve({
      ok: true,
      result: {
        kind: 'externalRef',
        externalRef: makeExternalRef(
          campaignId,
          'campaign_stats',
          `Campaign ${campaignId} stats`,
          `${this.#http.baseUrl}/s/campaigns/view/${campaignId}`,
        ),
      },
    });
  }

  async #triggerAutomation(input: In): Promise<Out> {
    const automationId = strOf(input.payload?.['automationId']);
    const contactId = strOf(input.payload?.['contactId']);
    if (!automationId)
      return { ok: false, error: 'validation_error', message: 'automationId is required.' };

    if (contactId) {
      await this.#http.post(`campaigns/${automationId}/contact/${contactId}/add`, {});
    }

    return {
      ok: true,
      result: {
        kind: 'externalRef',
        externalRef: makeExternalRef(
          `${automationId}-run-${Date.now()}`,
          'automation_run',
          `Automation ${automationId} triggered`,
          `${this.#http.baseUrl}/s/campaigns/view/${automationId}`,
        ),
      },
    };
  }

  // ── Forms ─────────────────────────────────────────────────────────────────

  async #listForms(_input: In): Promise<Out> {
    const data = await this.#http.get<{ forms: Record<string, Record<string, unknown>> }>('forms');
    const refs = Object.values(data.data.forms).map((f) =>
      makeExternalRef(
        strOf(f['id']),
        'form',
        strOf(f['name']),
        `${this.#http.baseUrl}/s/forms/view/${strOf(f['id'])}`,
      ),
    );
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }

  async #getFormSubmissions(input: In): Promise<Out> {
    const formId = strOf(input.payload?.['formId']);
    if (!formId) return { ok: false, error: 'validation_error', message: 'formId is required.' };

    const data = await this.#http.get<{ submissions: Record<string, Record<string, unknown>> }>(
      `forms/${formId}/submissions`,
    );
    const refs = Object.values(data.data.submissions ?? {}).map((s) =>
      makeExternalRef(
        strOf(s['id']),
        'form_submission',
        `Submission #${strOf(s['id'])}`,
        `${this.#http.baseUrl}/s/forms/results/${strOf(s['id'])}`,
      ),
    );
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }
}
