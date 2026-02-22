import { describe, it, expect, vi } from 'vitest';
import { ZammadCustomerSupportAdapter, type ZammadAdapterConfig } from './zammad-customer-support-adapter.js';
import type { CustomerSupportExecuteInputV1 } from '../../../application/ports/customer-support-adapter.js';
import { TenantId } from '../../../domain/primitives/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = TenantId('tenant-zammad-test');

const DEFAULT_CONFIG: ZammadAdapterConfig = {
  baseUrl: 'https://zammad.example.com',
  apiToken: 'test-api-token',
};

function makeFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAdapter(fetchFn: any = makeFetch([])) {
  return new ZammadCustomerSupportAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);
}

function makeInput(
  operation: CustomerSupportExecuteInputV1['operation'],
  payload?: Record<string, unknown>,
): CustomerSupportExecuteInputV1 {
  return { tenantId: TENANT_ID, operation, ...(payload !== undefined ? { payload } : {}) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ZammadCustomerSupportAdapter', () => {
  describe('listTickets', () => {
    it('maps Zammad tickets to TicketV1 array', async () => {
      const zammadTickets = [
        {
          id: 1,
          title: 'Cannot log in',
          state: 'new',
          priority: '2 normal',
          owner_id: 5,
          created_at: '2024-01-10T08:00:00Z',
        },
        {
          id: 2,
          title: 'Invoice missing',
          state: 'closed',
          priority: '3 high',
          owner_id: 1,
          created_at: '2024-01-11T09:00:00Z',
        },
      ];
      const adapter = makeAdapter(makeFetch(zammadTickets));

      const result = await adapter.execute(makeInput('listTickets'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('tickets');
      if (result.result.kind !== 'tickets') return;

      const tickets = result.result.tickets;
      expect(tickets).toHaveLength(2);
      expect(tickets[0]).toMatchObject({
        ticketId: '1',
        tenantId: TENANT_ID,
        schemaVersion: 1,
        subject: 'Cannot log in',
        status: 'open',
        priority: 'medium',
        assigneeId: '5',
        createdAtIso: '2024-01-10T08:00:00Z',
      });
      expect(tickets[1]).toMatchObject({
        status: 'closed',
        priority: 'high',
      });
      // owner_id=1 is the system user, no assigneeId
      expect(tickets[1]?.assigneeId).toBeUndefined();
    });
  });

  describe('getTicket', () => {
    it('returns a single ticket when found', async () => {
      const ticket = { id: 3, title: 'Printer broken', state: 'open', priority: '1 low', owner_id: 0, created_at: '2024-01-12T10:00:00Z' };
      const adapter = makeAdapter(makeFetch(ticket));

      const result = await adapter.execute(makeInput('getTicket', { ticketId: '3' }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('ticket');
      if (result.result.kind !== 'ticket') return;
      expect(result.result.ticket.ticketId).toBe('3');
      expect(result.result.ticket.priority).toBe('low');
    });

    it('returns validation_error when ticketId missing', async () => {
      const adapter = makeAdapter(makeFetch({}));
      const result = await adapter.execute(makeInput('getTicket'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('createTicket', () => {
    it('creates a ticket and returns TicketV1', async () => {
      const created = { id: 42, title: 'New issue', state: 'new', priority: '2 normal', owner_id: 0, created_at: '2024-02-01T00:00:00Z' };
      const adapter = makeAdapter(makeFetch(created));

      const result = await adapter.execute(
        makeInput('createTicket', { subject: 'New issue', body: 'Details here', groupId: 1 }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('ticket');
      if (result.result.kind !== 'ticket') return;
      expect(result.result.ticket.ticketId).toBe('42');
      expect(result.result.ticket.subject).toBe('New issue');
    });

    it('returns validation_error when subject missing', async () => {
      const adapter = makeAdapter(makeFetch({}));
      const result = await adapter.execute(makeInput('createTicket', { body: 'no subject' }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('closeTicket', () => {
    it('patches ticket state to closed and returns ticket', async () => {
      const closed = { id: 10, title: 'Resolved', state: 'closed', priority: '2 normal', owner_id: 0, created_at: '2024-01-01T00:00:00Z' };
      const fetchFn = makeFetch(closed);
      const adapter = makeAdapter(fetchFn);

      const result = await adapter.execute(makeInput('closeTicket', { ticketId: '10' }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('ticket');
      if (result.result.kind !== 'ticket') return;
      expect(result.result.ticket.status).toBe('closed');

      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('tickets/10');
      expect(init.method).toBe('PATCH');
    });
  });

  describe('listAgents', () => {
    it('maps Zammad users to PartyV1 with agent role', async () => {
      const users = [
        { id: 5, firstname: 'Alice', lastname: 'Smith', email: 'alice@example.com', phone: '' },
        { id: 6, firstname: '', lastname: '', email: null, login: 'bob' },
      ];
      const adapter = makeAdapter(makeFetch(users));

      const result = await adapter.execute(makeInput('listAgents'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('agents');
      if (result.result.kind !== 'agents') return;

      const agents = result.result.agents;
      expect(agents).toHaveLength(2);
      expect(agents[0]).toMatchObject({
        partyId: '5',
        tenantId: TENANT_ID,
        schemaVersion: 1,
        displayName: 'Alice Smith',
        email: 'alice@example.com',
        roles: ['agent'],
      });
      expect(agents[1]?.displayName).toBe('bob');
      expect(agents[1]?.email).toBeUndefined();
    });
  });

  describe('assignTicket', () => {
    it('returns accepted result', async () => {
      const adapter = makeAdapter(makeFetch({ id: 1 }));
      const result = await adapter.execute(makeInput('assignTicket', { ticketId: '5', agentId: '3' }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('accepted');
      if (result.result.kind !== 'accepted') return;
      expect(result.result.operation).toBe('assignTicket');
    });

    it('returns validation_error when ids missing', async () => {
      const adapter = makeAdapter(makeFetch({}));
      const result = await adapter.execute(makeInput('assignTicket', { ticketId: '5' }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('addComment', () => {
    it('posts article and returns accepted', async () => {
      const adapter = makeAdapter(makeFetch({ id: 99 }));
      const result = await adapter.execute(
        makeInput('addComment', { ticketId: '7', body: 'Fixed in v2.' }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('accepted');
    });
  });

  describe('listTags', () => {
    it('returns externalRefs for tags', async () => {
      const adapter = makeAdapter(makeFetch({ tags: ['billing', 'urgent'] }));
      const result = await adapter.execute(makeInput('listTags', { ticketId: '1' }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('externalRefs');
      if (result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs).toHaveLength(2);
      expect(result.result.externalRefs[0]?.externalId).toBe('billing');
    });
  });

  describe('listKnowledgeArticles', () => {
    it('returns DocumentV1 array', async () => {
      const articles = [
        { id: 10, title: 'How to reset password', created_at: '2024-01-01T00:00:00Z' },
        { id: 11, title: 'VPN setup guide', created_at: '2024-01-02T00:00:00Z' },
      ];
      const adapter = makeAdapter(makeFetch(articles));
      const result = await adapter.execute(makeInput('listKnowledgeArticles'));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('documents');
      if (result.result.kind !== 'documents') return;
      expect(result.result.documents).toHaveLength(2);
      expect(result.result.documents[0]?.title).toBe('How to reset password');
    });
  });

  describe('getSLA', () => {
    it('returns opaque SLA list', async () => {
      const slas = [{ id: 1, name: 'Standard SLA', first_response_time: 60 }];
      const adapter = makeAdapter(makeFetch(slas));
      const result = await adapter.execute(makeInput('getSLA'));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('opaque');
      if (result.result.kind !== 'opaque') return;
      expect(Array.isArray(result.result.payload['slas'])).toBe(true);
    });
  });

  describe('HTTP error handling', () => {
    it('wraps HTTP errors as provider_error', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });
      const adapter = makeAdapter(fetchFn);
      const result = await adapter.execute(makeInput('listTickets'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('provider_error');
      expect(result.message).toContain('404');
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
  });
});
