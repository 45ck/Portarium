/**
 * Unit tests for mautic-contact-ops.ts — segment operations that use MauticHttp.
 * Covers getSegment, addContactToSegment, and removeContactFromSegment.
 * Bead: bead-0733
 */

import { describe, expect, it, vi } from 'vitest';
import type { MarketingAutomationExecuteInputV1 } from '../../../application/ports/marketing-automation-adapter.js';
import { TenantId } from '../../../domain/primitives/index.js';
import type { MauticHttp } from './mautic-adapter-helpers.js';
import { addContactToSegment, getSegment, removeContactFromSegment } from './mautic-contact-ops.js';

const TENANT = TenantId('t-ops-1');

function makeInput(
  operation: MarketingAutomationExecuteInputV1['operation'],
  payload?: Record<string, unknown>,
): MarketingAutomationExecuteInputV1 {
  return { tenantId: TENANT, operation, ...(payload !== undefined ? { payload } : {}) };
}

function makeHttp(responseData: Record<string, unknown> = {}): MauticHttp {
  return {
    baseUrl: 'https://mautic.example.com',
    get: vi.fn().mockResolvedValue({ data: responseData, status: 200 }),
    post: vi.fn().mockResolvedValue({ data: {}, status: 200 }),
    patch: vi.fn().mockResolvedValue({ data: {}, status: 200 }),
  };
}

// ── getSegment ─────────────────────────────────────────────────────────────

describe('getSegment', () => {
  it('returns externalRef for a found segment', async () => {
    const http = makeHttp({ list: { id: '1', name: 'Newsletter' } });
    const result = await getSegment(http, makeInput('getList', { listId: '1' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('externalRef');
    if (result.result.kind !== 'externalRef') return;
    expect(result.result.externalRef.externalType).toBe('segment');
    expect(result.result.externalRef.externalId).toBe('1');
  });

  it('returns validation_error when listId is missing', async () => {
    const http = makeHttp({});
    const result = await getSegment(http, makeInput('getList'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('returns not_found when segment is absent in response', async () => {
    const http = makeHttp({});
    const result = await getSegment(http, makeInput('getList', { listId: '99' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });
});

// ── addContactToSegment ────────────────────────────────────────────────────

describe('addContactToSegment', () => {
  it('posts to segment endpoint and returns accepted', async () => {
    const http = makeHttp({});
    const result = await addContactToSegment(
      http,
      makeInput('addContactToList', { listId: '1', contactId: '42' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('accepted');
    expect(http.post).toHaveBeenCalledWith(
      expect.stringContaining('segments/1/contact/42/add'),
      {},
    );
  });

  it('returns validation_error when listId is missing', async () => {
    const http = makeHttp({});
    const result = await addContactToSegment(
      http,
      makeInput('addContactToList', { contactId: '42' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('returns validation_error when contactId is missing', async () => {
    const http = makeHttp({});
    const result = await addContactToSegment(http, makeInput('addContactToList', { listId: '1' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

// ── removeContactFromSegment ───────────────────────────────────────────────

describe('removeContactFromSegment', () => {
  it('posts to remove endpoint and returns accepted', async () => {
    const http = makeHttp({});
    const result = await removeContactFromSegment(
      http,
      makeInput('removeContactFromList', { listId: '1', contactId: '42' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('accepted');
    expect(http.post).toHaveBeenCalledWith(
      expect.stringContaining('segments/1/contact/42/remove'),
      {},
    );
  });

  it('returns validation_error when listId is missing', async () => {
    const http = makeHttp({});
    const result = await removeContactFromSegment(
      http,
      makeInput('removeContactFromList', { contactId: '42' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('returns validation_error when contactId is missing', async () => {
    const http = makeHttp({});
    const result = await removeContactFromSegment(
      http,
      makeInput('removeContactFromList', { listId: '1' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});
