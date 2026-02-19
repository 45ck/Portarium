import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryCustomerSupportAdapter } from './in-memory-customer-support-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryCustomerSupportAdapter', () => {
  it('returns tenant-scoped tickets', async () => {
    const seedA = InMemoryCustomerSupportAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryCustomerSupportAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryCustomerSupportAdapter({
      seed: {
        ...seedA,
        tickets: [...seedA.tickets!, ...seedB.tickets!],
      },
    });

    const result = await adapter.execute({ tenantId: TENANT_A, operation: 'listTickets' });
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'tickets') return;
    expect(result.result.tickets).toHaveLength(1);
    expect(result.result.tickets[0]?.tenantId).toBe(TENANT_A);
  });

  it('creates, updates, closes, and retrieves tickets', async () => {
    const adapter = new InMemoryCustomerSupportAdapter({
      seed: InMemoryCustomerSupportAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createTicket',
      payload: { subject: 'Login issue', priority: 'high' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'ticket') return;
    const ticketId = created.result.ticket.ticketId;
    expect(created.result.ticket.createdAtIso).toBe('2026-02-19T00:00:00.000Z');

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateTicket',
      payload: { ticketId, status: 'pending', assigneeId: 'agent-1000' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'ticket') return;
    expect(updated.result.ticket.status).toBe('pending');

    const closed = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'closeTicket',
      payload: { ticketId },
    });
    expect(closed.ok).toBe(true);
    if (!closed.ok || closed.result.kind !== 'ticket') return;
    expect(closed.result.ticket.status).toBe('closed');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getTicket',
      payload: { ticketId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'ticket') return;
    expect(fetched.result.ticket.ticketId).toBe(ticketId);
  });

  it('lists agents and assigns tickets', async () => {
    const adapter = new InMemoryCustomerSupportAdapter({
      seed: InMemoryCustomerSupportAdapter.seedMinimal(TENANT_A),
    });

    const agents = await adapter.execute({ tenantId: TENANT_A, operation: 'listAgents' });
    expect(agents.ok).toBe(true);
    if (!agents.ok || agents.result.kind !== 'agents') return;
    expect(agents.result.agents).toHaveLength(1);

    const assigned = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'assignTicket',
      payload: { ticketId: 'ticket-1000', assigneeId: agents.result.agents[0]!.partyId },
    });
    expect(assigned.ok).toBe(true);
    if (!assigned.ok || assigned.result.kind !== 'ticket') return;
    expect(assigned.result.ticket.assigneeId).toBe(agents.result.agents[0]!.partyId);
  });

  it('supports comment and tag operations', async () => {
    const adapter = new InMemoryCustomerSupportAdapter({
      seed: InMemoryCustomerSupportAdapter.seedMinimal(TENANT_A),
    });

    const createdComment = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'addComment',
      payload: { ticketId: 'ticket-1000', content: 'Need customer logs' },
    });
    expect(createdComment.ok).toBe(true);
    if (!createdComment.ok || createdComment.result.kind !== 'externalRef') return;

    const comments = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listComments',
      payload: { ticketId: 'ticket-1000' },
    });
    expect(comments.ok).toBe(true);
    if (!comments.ok || comments.result.kind !== 'externalRefs') return;
    expect(comments.result.externalRefs.some((ref) => ref.externalId === createdComment.result.externalRef.externalId)).toBe(true);

    const tags = await adapter.execute({ tenantId: TENANT_A, operation: 'listTags' });
    expect(tags.ok).toBe(true);
    if (!tags.ok || tags.result.kind !== 'externalRefs') return;
    expect(tags.result.externalRefs).toHaveLength(1);

    const createdTag = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createTag',
      payload: { name: 'outage' },
    });
    expect(createdTag.ok).toBe(true);
    if (!createdTag.ok || createdTag.result.kind !== 'externalRef') return;
    expect(createdTag.result.externalRef.externalType).toBe('ticket_tag');
  });

  it('supports knowledge article, SLA, and CSAT operations', async () => {
    const adapter = new InMemoryCustomerSupportAdapter({
      seed: InMemoryCustomerSupportAdapter.seedMinimal(TENANT_A),
    });

    const articles = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listKnowledgeArticles',
    });
    expect(articles.ok).toBe(true);
    if (!articles.ok || articles.result.kind !== 'documents') return;
    expect(articles.result.documents).toHaveLength(1);

    const article = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getKnowledgeArticle',
      payload: { documentId: articles.result.documents[0]!.documentId },
    });
    expect(article.ok).toBe(true);
    if (!article.ok || article.result.kind !== 'document') return;
    expect(article.result.document.documentId).toBe(articles.result.documents[0]!.documentId);

    const sla = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getSLA',
      payload: { ticketId: 'ticket-1000' },
    });
    expect(sla.ok).toBe(true);
    if (!sla.ok || sla.result.kind !== 'externalRef') return;
    expect(sla.result.externalRef.externalType).toBe('sla_policy');

    const csat = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listCustomerSatisfactionRatings',
    });
    expect(csat.ok).toBe(true);
    if (!csat.ok || csat.result.kind !== 'externalRefs') return;
    expect(csat.result.externalRefs).toHaveLength(1);
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryCustomerSupportAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listTickets',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported CustomerSupport operation: bogusOperation.',
    });
  });
});
