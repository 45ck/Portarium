/**
 * Unit tests for MauticMarketingAutomationAdapter.
 * Uses a fetch mock; no real HTTP calls.
 * Bead: bead-0421
 */

import { describe, it, expect, vi } from 'vitest';
import { MauticMarketingAutomationAdapter } from './mautic-marketing-automation-adapter.js';
import type { MarketingAutomationExecuteInputV1 } from '../../../application/ports/marketing-automation-adapter.js';
import { TenantId } from '../../../domain/primitives/index.js';

const TENANT = TenantId('tenant-mautic-test');
const BASE_URL = 'https://mautic.example.com';

function makeInput(
  operation: MarketingAutomationExecuteInputV1['operation'],
  payload?: Record<string, unknown>,
): MarketingAutomationExecuteInputV1 {
  return { tenantId: TENANT, operation, ...(payload !== undefined ? { payload } : {}) };
}

function makeFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function makeAdapter(fetchFn = makeFetch({})) {
  return new MauticMarketingAutomationAdapter(
    { baseUrl: BASE_URL, username: 'admin', password: 'pass' },
    fetchFn as unknown as typeof fetch,
  );
}

// ── listContacts ────────────────────────────────────────────────────────────

describe('listContacts', () => {
  it('maps Mautic contacts to PartyV1', async () => {
    const fetchFn = makeFetch({
      contacts: {
        '1': {
          id: '1',
          fields: { all: { firstname: 'Alice', lastname: 'Smith', email: 'alice@example.com' } },
        },
        '2': {
          id: '2',
          fields: { all: { firstname: 'Bob', lastname: '', email: 'bob@example.com' } },
        },
      },
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listContacts'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('parties');
    if (result.result.kind !== 'parties') return;
    expect(result.result.parties).toHaveLength(2);
    expect(result.result.parties[0]?.displayName).toBe('Alice Smith');
    expect(result.result.parties[1]?.displayName).toBe('Bob');
  });
});

// ── getContact ─────────────────────────────────────────────────────────────

describe('getContact', () => {
  it('returns a PartyV1 for a known contact', async () => {
    const fetchFn = makeFetch({
      contact: {
        id: '42',
        fields: { all: { firstname: 'Carol', lastname: 'Doe', email: 'carol@example.com' } },
      },
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('getContact', { contactId: '42' }));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'party') return;
    expect(result.result.party.partyId).toBe('42');
    expect(result.result.party.email).toBe('carol@example.com');
  });

  it('returns validation_error when contactId is missing', async () => {
    const result = await makeAdapter().execute(makeInput('getContact'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('returns not_found when Mautic returns empty contact', async () => {
    const fetchFn = makeFetch({ contact: null });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('getContact', { contactId: '99' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });
});

// ── createContact ──────────────────────────────────────────────────────────

describe('createContact', () => {
  it('creates contact and returns party', async () => {
    const fetchFn = makeFetch({
      contact: {
        id: '100',
        fields: { all: { firstname: 'Dave', lastname: 'Doe', email: 'dave@example.com' } },
      },
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(
      makeInput('createContact', {
        displayName: 'Dave Doe',
        email: 'dave@example.com',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'party') return;
    expect(result.result.party.partyId).toBe('100');
  });

  it('returns validation_error when displayName is missing', async () => {
    const result = await makeAdapter().execute(makeInput('createContact', {}));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('sends POST to /api/contacts/new', async () => {
    const fetchFn = makeFetch({
      contact: { id: '1', fields: { all: { firstname: 'Eve', lastname: 'Adams' } } },
    });
    const adapter = makeAdapter(fetchFn);
    await adapter.execute(makeInput('createContact', { displayName: 'Eve Adams' }));

    // Verify URL contains contacts/new
    expect((fetchFn.mock.calls[0] as [string, RequestInit])[0]).toContain('contacts/new');
    // Verify method is POST
    expect((fetchFn.mock.calls[0] as [string, RequestInit])[1].method).toBe('POST');
  });
});

// ── listCampaigns ──────────────────────────────────────────────────────────

describe('listCampaigns', () => {
  it('maps Mautic campaigns to CampaignV1', async () => {
    const fetchFn = makeFetch({
      campaigns: {
        '1': { id: '1', name: 'Welcome Series', isPublished: true },
        '2': { id: '2', name: 'Re-engagement', isPublished: false },
      },
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listCampaigns'));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'campaigns') return;
    expect(result.result.campaigns).toHaveLength(2);
    expect(result.result.campaigns[0]?.status).toBe('active');
    expect(result.result.campaigns[1]?.status).toBe('draft');
  });
});

// ── listLists (segments) ───────────────────────────────────────────────────

describe('listLists', () => {
  it('maps Mautic segments to ExternalObjectRefs', async () => {
    const fetchFn = makeFetch({
      lists: {
        '5': { id: '5', name: 'Newsletter Subscribers' },
      },
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listLists'));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'externalRefs') return;
    expect(result.result.externalRefs[0]?.externalId).toBe('5');
    expect(result.result.externalRefs[0]?.sorName).toBe('Mautic');
  });
});

// ── updateContact ──────────────────────────────────────────────────────────

describe('updateContact', () => {
  it('patches contact and returns updated party', async () => {
    const fetchFn = makeFetch({
      contact: { id: '5', fields: { all: { firstname: 'Frank', lastname: 'Stone' } } },
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(
      makeInput('updateContact', { contactId: '5', displayName: 'Frank Stone' }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'party') return;
    expect(result.result.party.partyId).toBe('5');
    expect((fetchFn.mock.calls[0] as [string, RequestInit])[1].method).toBe('PATCH');
  });

  it('returns validation_error when contactId is missing', async () => {
    const result = await makeAdapter().execute(makeInput('updateContact', {}));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

// ── getCampaign ─────────────────────────────────────────────────────────────

describe('getCampaign', () => {
  it('returns not_found when campaign is missing', async () => {
    const fetchFn = makeFetch({ campaign: null });
    const result = await makeAdapter(fetchFn).execute(
      makeInput('getCampaign', { campaignId: '99' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });

  it('returns validation_error when campaignId is missing', async () => {
    const result = await makeAdapter().execute(makeInput('getCampaign'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

// ── getCampaignStats ────────────────────────────────────────────────────────

describe('getCampaignStats', () => {
  it('returns externalRef pointing to stats page', async () => {
    const result = await makeAdapter().execute(makeInput('getCampaignStats', { campaignId: '7' }));
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'externalRef') return;
    expect(result.result.externalRef.externalId).toBe('7');
    expect(result.result.externalRef.externalType).toBe('campaign_stats');
    expect(result.result.externalRef.deepLinkUrl).toContain('7');
  });

  it('returns validation_error when campaignId is missing', async () => {
    const result = await makeAdapter().execute(makeInput('getCampaignStats'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

// ── listForms / getFormSubmissions ──────────────────────────────────────────

describe('listForms', () => {
  it('maps Mautic forms to ExternalObjectRefs', async () => {
    const fetchFn = makeFetch({ forms: { '3': { id: '3', name: 'Contact Form' } } });
    const result = await makeAdapter(fetchFn).execute(makeInput('listForms'));
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'externalRefs') return;
    expect(result.result.externalRefs[0]?.externalId).toBe('3');
  });
});

describe('getFormSubmissions', () => {
  it('maps Mautic form submissions to ExternalObjectRefs', async () => {
    const fetchFn = makeFetch({ submissions: { '10': { id: '10' } } });
    const result = await makeAdapter(fetchFn).execute(
      makeInput('getFormSubmissions', { formId: '3' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'externalRefs') return;
    expect(result.result.externalRefs[0]?.externalId).toBe('10');
  });

  it('returns validation_error when formId is missing', async () => {
    const result = await makeAdapter().execute(makeInput('getFormSubmissions'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

// ── unsupported_operation ──────────────────────────────────────────────────

describe('unsupported_operation', () => {
  it('returns unsupported_operation for unknown operations', async () => {
    const result = await makeAdapter().execute({
      tenantId: TENANT,
      operation: 'unknownOp' as MarketingAutomationExecuteInputV1['operation'],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('unsupported_operation');
  });
});

// ── provider_error ─────────────────────────────────────────────────────────

describe('provider_error handling', () => {
  it('wraps HTTP errors as provider_error', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listContacts'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('provider_error');
    expect(result.message).toContain('HTTP 500');
  });

  it('wraps network failures as provider_error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listContacts'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('provider_error');
  });
});
