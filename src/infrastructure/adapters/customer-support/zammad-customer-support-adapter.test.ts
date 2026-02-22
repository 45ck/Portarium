/**
 * Unit tests for ZammadCustomerSupportAdapter.
 * Uses a fetch mock; no real HTTP calls.
 * Bead: bead-0423
 */

import { describe, it, expect, vi } from 'vitest';
import { ZammadCustomerSupportAdapter } from './zammad-customer-support-adapter.js';
import type { CustomerSupportExecuteInputV1 } from '../../../application/ports/customer-support-adapter.js';
import { TenantId } from '../../../domain/primitives/index.js';

const TENANT = TenantId('tenant-zammad-test');
const BASE_URL = 'https://zammad.example.com';

function makeInput(
  operation: CustomerSupportExecuteInputV1['operation'],
  payload?: Record<string, unknown>,
): CustomerSupportExecuteInputV1 {
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

function makeAdapter(fetchFn = makeFetch([])) {
  return new ZammadCustomerSupportAdapter(
    { baseUrl: BASE_URL, apiToken: 'test-token-abc123' },
    fetchFn as unknown as typeof fetch,
  );
}

// ── listTickets ─────────────────────────────────────────────────────────────

describe('listTickets', () => {
  it('maps Zammad tickets to TicketV1', async () => {
    const fetchFn = makeFetch([
      {
        id: '1',
        title: 'Login broken',
        state: 'open',
        priority: '2 normal',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        title: 'Password reset',
        state: 'closed',
        priority: '1 low',
        created_at: '2026-01-02T00:00:00Z',
      },
    ]);
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listTickets'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('tickets');
    if (result.result.kind !== 'tickets') return;
    expect(result.result.tickets).toHaveLength(2);
    expect(result.result.tickets[0]?.subject).toBe('Login broken');
    expect(result.result.tickets[0]?.status).toBe('open');
    expect(result.result.tickets[1]?.status).toBe('closed');
  });
});

// ── getTicket ───────────────────────────────────────────────────────────────

describe('getTicket', () => {
  it('returns a TicketV1 for a known ticket', async () => {
    const fetchFn = makeFetch({
      id: '42',
      title: 'API returns 500',
      state: 'open',
      priority: '3 high',
      created_at: '2026-01-10T08:00:00Z',
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('getTicket', { ticketId: '42' }));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'ticket') return;
    expect(result.result.ticket.ticketId).toBe('42');
    expect(result.result.ticket.status).toBe('open');
    expect(result.result.ticket.subject).toBe('API returns 500');
  });

  it('returns validation_error when ticketId is missing', async () => {
    const result = await makeAdapter().execute(makeInput('getTicket'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('returns not_found when Zammad returns empty body', async () => {
    const fetchFn = makeFetch({});
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('getTicket', { ticketId: '99' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });
});

// ── createTicket ────────────────────────────────────────────────────────────

describe('createTicket', () => {
  it('creates ticket and returns TicketV1', async () => {
    const fetchFn = makeFetch({
      id: '100',
      title: 'New issue',
      state: 'new',
      priority: '2 normal',
      created_at: '2026-02-01T09:00:00Z',
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(
      makeInput('createTicket', { subject: 'New issue', body: 'Details here.' }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'ticket') return;
    expect(result.result.ticket.ticketId).toBe('100');
    expect(result.result.ticket.subject).toBe('New issue');
    expect(result.result.ticket.status).toBe('open'); // 'new' maps to 'open'
  });

  it('returns validation_error when subject is missing', async () => {
    const result = await makeAdapter().execute(makeInput('createTicket', {}));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('sends POST to /api/v1/tickets', async () => {
    const fetchFn = makeFetch({
      id: '1',
      title: 'Test',
      state: 'new',
      priority: '2 normal',
      created_at: '2026-01-01T00:00:00Z',
    });
    const adapter = makeAdapter(fetchFn);
    await adapter.execute(makeInput('createTicket', { subject: 'Test' }));

    expect((fetchFn.mock.calls[0] as [string, RequestInit])[0]).toContain('/api/v1/tickets');
    expect((fetchFn.mock.calls[0] as [string, RequestInit])[1].method).toBe('POST');
  });
});

// ── closeTicket ─────────────────────────────────────────────────────────────

describe('closeTicket', () => {
  it('sets state to closed and returns updated ticket', async () => {
    const fetchFn = makeFetch({
      id: '5',
      title: 'Resolved issue',
      state: 'closed',
      priority: '2 normal',
      created_at: '2026-01-05T00:00:00Z',
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('closeTicket', { ticketId: '5' }));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'ticket') return;
    expect(result.result.ticket.status).toBe('closed');
  });

  it('returns validation_error when ticketId is missing', async () => {
    const result = await makeAdapter().execute(makeInput('closeTicket'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

// ── listAgents ──────────────────────────────────────────────────────────────

describe('listAgents', () => {
  it('maps Zammad users to PartyV1', async () => {
    const fetchFn = makeFetch([
      { id: '10', firstname: 'Alice', lastname: 'Smith', email: 'alice@support.example.com' },
      { id: '11', firstname: 'Bob', lastname: 'Jones', email: 'bob@support.example.com' },
    ]);
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listAgents'));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'agents') return;
    expect(result.result.agents).toHaveLength(2);
    expect(result.result.agents[0]?.displayName).toBe('Alice Smith');
    expect(result.result.agents[0]?.email).toBe('alice@support.example.com');
  });
});

// ── addComment ──────────────────────────────────────────────────────────────

describe('addComment', () => {
  it('posts article and returns externalRef', async () => {
    const fetchFn = makeFetch({ id: '200', subject: 'Re: issue', body: 'Fixed in v2.' });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(
      makeInput('addComment', { ticketId: '42', content: 'Fixed in v2.' }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'externalRef') return;
    expect(result.result.externalRef.externalType).toBe('ticket_article');
    expect(result.result.externalRef.sorName).toBe('Zammad');
  });

  it('returns validation_error when ticketId is missing', async () => {
    const result = await makeAdapter().execute(makeInput('addComment', { content: 'oops' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('returns validation_error when content is missing', async () => {
    const result = await makeAdapter().execute(makeInput('addComment', { ticketId: '1' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

// ── listComments ─────────────────────────────────────────────────────────────

describe('listComments', () => {
  it('returns externalRefs for all articles on a ticket', async () => {
    const fetchFn = makeFetch([
      { id: '300', subject: 'First response', body: 'Looking into this.' },
      { id: '301', subject: 'Update', body: 'Found the cause.' },
    ]);
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listComments', { ticketId: '42' }));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'externalRefs') return;
    expect(result.result.externalRefs).toHaveLength(2);
    expect(result.result.externalRefs[0]?.externalId).toBe('300');
  });

  it('returns validation_error when ticketId is missing', async () => {
    const result = await makeAdapter().execute(makeInput('listComments'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

// ── listTags ─────────────────────────────────────────────────────────────────

describe('listTags', () => {
  it('returns externalRefs for tags', async () => {
    const fetchFn = makeFetch({ tags: ['billing', 'urgent', 'escalated'] });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listTags', { ticketId: '42' }));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'externalRefs') return;
    expect(result.result.externalRefs).toHaveLength(3);
    expect(result.result.externalRefs[0]?.displayLabel).toBe('billing');
  });
});

// ── createTag ─────────────────────────────────────────────────────────────────

describe('createTag', () => {
  it('creates tag and returns externalRef', async () => {
    const fetchFn = makeFetch({});
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('createTag', { name: 'urgent', ticketId: '5' }));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'externalRef') return;
    expect(result.result.externalRef.displayLabel).toBe('urgent');
    expect(result.result.externalRef.externalType).toBe('ticket_tag');
  });

  it('returns validation_error when name is missing', async () => {
    const result = await makeAdapter().execute(makeInput('createTag', {}));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

// ── listKnowledgeArticles ─────────────────────────────────────────────────────

describe('listKnowledgeArticles', () => {
  it('maps Zammad knowledge base items to DocumentV1', async () => {
    const fetchFn = makeFetch([
      { id: '1', title: 'How to reset password', created_at: '2025-06-01T00:00:00Z' },
      { id: '2', title: 'API rate limits', created_at: '2025-07-01T00:00:00Z' },
    ]);
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listKnowledgeArticles'));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'documents') return;
    expect(result.result.documents).toHaveLength(2);
    expect(result.result.documents[0]?.title).toBe('How to reset password');
    expect(result.result.documents[0]?.mimeType).toBe('text/html');
  });
});

// ── getKnowledgeArticle ───────────────────────────────────────────────────────

describe('getKnowledgeArticle', () => {
  it('returns a DocumentV1 for a known article', async () => {
    const fetchFn = makeFetch({
      id: '7',
      title: 'Billing FAQ',
      created_at: '2025-08-01T00:00:00Z',
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('getKnowledgeArticle', { documentId: '7' }));

    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'document') return;
    expect(result.result.document.title).toBe('Billing FAQ');
  });

  it('returns validation_error when documentId is missing', async () => {
    const result = await makeAdapter().execute(makeInput('getKnowledgeArticle'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('returns not_found when article has no id', async () => {
    const fetchFn = makeFetch({});
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('getKnowledgeArticle', { documentId: '999' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });
});

// ── provider_error handling ──────────────────────────────────────────────────

describe('provider_error handling', () => {
  it('wraps HTTP errors as provider_error', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    });
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listTickets'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('provider_error');
    expect(result.message).toContain('HTTP 503');
  });

  it('wraps network failures as provider_error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const adapter = makeAdapter(fetchFn);
    const result = await adapter.execute(makeInput('listTickets'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('provider_error');
    expect(result.message).toContain('ECONNREFUSED');
  });

  it('uses Token auth header', async () => {
    const fetchFn = makeFetch([]);
    const adapter = makeAdapter(fetchFn);
    await adapter.execute(makeInput('listTickets'));

    const headers = (fetchFn.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    expect(headers['Authorization']).toBe('Token token=test-token-abc123');
  });
});
