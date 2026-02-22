/**
 * Unit tests for mautic-marketing-automation-mappers.ts pure helper functions.
 * Covers toStr, mappers, and segment/form operation helpers.
 * Bead: bead-0421
 */

import { describe, expect, it, vi } from 'vitest';
import type { MarketingAutomationExecuteInputV1 } from '../../../application/ports/marketing-automation-adapter.js';
import { TenantId } from '../../../domain/primitives/index.js';
import type { MauticOpsContext } from './mautic-marketing-automation-mappers.js';
import {
  makeMauticRef,
  mapMauticCampaignToCampaign,
  mapMauticContactToParty,
  mauticAddContactToSegment,
  mauticGetFormSubmissions,
  mauticGetSegment,
  mauticListForms,
  mauticListSegments,
  mauticRemoveContactFromSegment,
  mauticTriggerAutomation,
  toStr,
} from './mautic-marketing-automation-mappers.js';

const TENANT = TenantId('t-1');

function makeInput(
  operation: MarketingAutomationExecuteInputV1['operation'],
  payload?: Record<string, unknown>,
): MarketingAutomationExecuteInputV1 {
  return { tenantId: TENANT, operation, ...(payload !== undefined ? { payload } : {}) };
}

function makeCtx(getData: Record<string, unknown> = {}): MauticOpsContext {
  return {
    baseUrl: 'https://mautic.example.com',
    get: vi.fn().mockResolvedValue(getData),
    post: vi.fn().mockResolvedValue({}),
  };
}

// ── toStr ─────────────────────────────────────────────────────────────────────

describe('toStr', () => {
  it('returns string as-is', () => {
    expect(toStr('hello')).toBe('hello');
  });

  it('converts number to string', () => {
    expect(toStr(42)).toBe('42');
  });

  it('converts boolean to string', () => {
    expect(toStr(true)).toBe('true');
  });

  it('returns fallback for non-primitive types', () => {
    expect(toStr({})).toBe('');
    expect(toStr(null)).toBe('');
    expect(toStr(undefined)).toBe('');
  });

  it('returns custom fallback', () => {
    expect(toStr(null, 'N/A')).toBe('N/A');
  });
});

// ── mapMauticContactToParty ───────────────────────────────────────────────────

describe('mapMauticContactToParty', () => {
  it('maps full contact with email and name', () => {
    const contact = {
      id: '1',
      fields: { all: { firstname: 'Alice', lastname: 'Smith', email: 'alice@example.com' } },
    };
    const party = mapMauticContactToParty(contact, String(TENANT));
    expect(party.displayName).toBe('Alice Smith');
    expect(party.email).toBe('alice@example.com');
    expect(party.roles).toContain('lead');
  });

  it('falls back to email as displayName when names are empty', () => {
    const contact = {
      id: '2',
      fields: { all: { firstname: '', lastname: '', email: 'user@example.com' } },
    };
    const party = mapMauticContactToParty(contact, String(TENANT));
    expect(party.displayName).toBe('user@example.com');
  });

  it('falls back to id when all name fields are empty', () => {
    const contact = { id: '99', fields: { all: {} } };
    const party = mapMauticContactToParty(contact, String(TENANT));
    expect(party.displayName).toBe('99');
  });

  it('omits email when not a string', () => {
    const contact = { id: '3', fields: { all: { email: 42 } } };
    const party = mapMauticContactToParty(contact, String(TENANT));
    expect('email' in party).toBe(false);
  });
});

// ── mapMauticCampaignToCampaign ───────────────────────────────────────────────

describe('mapMauticCampaignToCampaign', () => {
  it('maps published campaign to active status', () => {
    const campaign = { id: '10', name: 'Newsletter', isPublished: true };
    const result = mapMauticCampaignToCampaign(campaign, String(TENANT));
    expect(result.status).toBe('active');
    expect(result.name).toBe('Newsletter');
  });

  it('maps unpublished campaign to draft status', () => {
    const campaign = { id: '11', name: 'Draft', isPublished: false };
    const result = mapMauticCampaignToCampaign(campaign, String(TENANT));
    expect(result.status).toBe('draft');
  });
});

// ── makeMauticRef ─────────────────────────────────────────────────────────────

describe('makeMauticRef', () => {
  it('builds an ExternalObjectRef with correct fields', () => {
    const ref = makeMauticRef({
      id: '5',
      externalType: 'segment',
      displayLabel: 'Newsletter List',
      baseUrl: 'https://mautic.example.com',
      path: 's/segments',
    });
    expect(ref.sorName).toBe('Mautic');
    expect(ref.externalType).toBe('segment');
    expect(ref.externalId).toBe('5');
    expect(ref.deepLinkUrl).toContain('s/segments/5');
  });

  it('handles numeric id', () => {
    const ref = makeMauticRef({
      id: 10,
      externalType: 'form',
      displayLabel: 'Contact Form',
      baseUrl: 'https://mautic.example.com',
      path: 's/forms/view',
    });
    expect(ref.externalId).toBe('10');
  });
});

// ── Segment operations ────────────────────────────────────────────────────────

describe('mauticListSegments', () => {
  it('returns externalRefs for all segments', async () => {
    const ctx = makeCtx({ lists: { '1': { id: '1', name: 'Newsletter' } } });
    const result = await mauticListSegments(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('externalRefs');
    if (result.result.kind !== 'externalRefs') return;
    expect(result.result.externalRefs[0]?.externalType).toBe('segment');
  });
});

describe('mauticGetSegment', () => {
  it('returns externalRef for a found segment', async () => {
    const ctx = makeCtx({ list: { id: '1', name: 'Newsletter' } });
    const result = await mauticGetSegment(ctx, makeInput('getList', { listId: '1' }));
    expect(result.ok).toBe(true);
  });

  it('returns validation_error when listId missing', async () => {
    const ctx = makeCtx({});
    const result = await mauticGetSegment(ctx, makeInput('getList'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('returns not_found when list is absent in response', async () => {
    const ctx = makeCtx({});
    const result = await mauticGetSegment(ctx, makeInput('getList', { listId: '99' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });
});

describe('mauticAddContactToSegment', () => {
  it('adds contact and returns accepted', async () => {
    const ctx = makeCtx({});
    const result = await mauticAddContactToSegment(
      ctx,
      makeInput('addContactToList', { listId: '1', contactId: '42' }),
    );
    expect(result.ok).toBe(true);
  });

  it('returns validation_error when listId or contactId missing', async () => {
    const ctx = makeCtx({});
    const result = await mauticAddContactToSegment(
      ctx,
      makeInput('addContactToList', { listId: '1' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

describe('mauticRemoveContactFromSegment', () => {
  it('removes contact and returns accepted', async () => {
    const ctx = makeCtx({});
    const result = await mauticRemoveContactFromSegment(
      ctx,
      makeInput('removeContactFromList', { listId: '1', contactId: '42' }),
    );
    expect(result.ok).toBe(true);
  });

  it('returns validation_error when fields missing', async () => {
    const ctx = makeCtx({});
    const result = await mauticRemoveContactFromSegment(
      ctx,
      makeInput('removeContactFromList', { contactId: '42' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

describe('mauticTriggerAutomation', () => {
  it('triggers automation and returns externalRef', async () => {
    const ctx = makeCtx({});
    const result = await mauticTriggerAutomation(
      ctx,
      makeInput('triggerAutomation', { automationId: '5' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('externalRef');
  });

  it('returns validation_error when automationId missing', async () => {
    const ctx = makeCtx({});
    const result = await mauticTriggerAutomation(ctx, makeInput('triggerAutomation'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('posts contact-to-campaign when contactId is provided', async () => {
    const ctx = makeCtx({});
    await mauticTriggerAutomation(
      ctx,
      makeInput('triggerAutomation', { automationId: '5', contactId: '99' }),
    );
    expect(ctx.post).toHaveBeenCalledWith(expect.stringContaining('campaigns/5/contact/99'), {});
  });
});

describe('mauticListForms', () => {
  it('returns externalRefs for all forms', async () => {
    const ctx = makeCtx({ forms: { '1': { id: '1', name: 'Contact Form' } } });
    const result = await mauticListForms(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('externalRefs');
    if (result.result.kind !== 'externalRefs') return;
    expect(result.result.externalRefs[0]?.externalType).toBe('form');
  });
});

describe('mauticGetFormSubmissions', () => {
  it('returns externalRefs for form submissions', async () => {
    const ctx = makeCtx({ submissions: { '1': { id: '1' } } });
    const result = await mauticGetFormSubmissions(
      ctx,
      makeInput('getFormSubmissions', { formId: '1' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('externalRefs');
  });

  it('returns validation_error when formId missing', async () => {
    const ctx = makeCtx({});
    const result = await mauticGetFormSubmissions(ctx, makeInput('getFormSubmissions'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('handles empty submissions gracefully', async () => {
    const ctx = makeCtx({});
    const result = await mauticGetFormSubmissions(
      ctx,
      makeInput('getFormSubmissions', { formId: '5' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.result.kind !== 'externalRefs') return;
    expect(result.result.externalRefs).toHaveLength(0);
  });
});
