import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryCustomerSupportAdapter } from './in-memory-customer-support-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryCustomerSupportAdapter integration', () => {
  it('supports ticket create/get/update/close/list flow', async () => {
    const adapter = new InMemoryCustomerSupportAdapter({
      seed: InMemoryCustomerSupportAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createTicket',
      payload: { subject: 'Unable to sync invoices', priority: 'high' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'ticket') return;
    expect(created.result.ticket.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
    const ticketId = created.result.ticket.ticketId;

    const updated = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateTicket',
      payload: { ticketId, status: 'pending' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'ticket') return;
    expect(updated.result.ticket.status).toBe('pending');

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getTicket',
      payload: { ticketId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'ticket') return;
    expect(fetched.result.ticket.ticketId).toBe(ticketId);

    const closed = await adapter.execute({
      tenantId: TENANT,
      operation: 'closeTicket',
      payload: { ticketId },
    });
    expect(closed.ok).toBe(true);
    if (!closed.ok || closed.result.kind !== 'ticket') return;
    expect(closed.result.ticket.status).toBe('closed');

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listTickets' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'tickets') return;
    expect(listed.result.tickets.some((ticket) => ticket.ticketId === ticketId)).toBe(true);
  });

  it('supports assignment/comment/tag operations', async () => {
    const adapter = new InMemoryCustomerSupportAdapter({
      seed: InMemoryCustomerSupportAdapter.seedMinimal(TENANT),
    });

    const agents = await adapter.execute({ tenantId: TENANT, operation: 'listAgents' });
    expect(agents.ok).toBe(true);
    if (!agents.ok || agents.result.kind !== 'agents') return;
    const assigneeId = agents.result.agents[0]!.partyId;

    const assigned = await adapter.execute({
      tenantId: TENANT,
      operation: 'assignTicket',
      payload: { ticketId: 'ticket-1000', assigneeId },
    });
    expect(assigned.ok).toBe(true);
    if (!assigned.ok || assigned.result.kind !== 'ticket') return;
    expect(assigned.result.ticket.assigneeId).toBe(assigneeId);

    const comment = await adapter.execute({
      tenantId: TENANT,
      operation: 'addComment',
      payload: { ticketId: 'ticket-1000', content: 'Collected browser logs' },
    });
    expect(comment.ok).toBe(true);
    if (!comment.ok || comment.result.kind !== 'externalRef') return;
    const commentId = comment.result.externalRef.externalId;

    const comments = await adapter.execute({
      tenantId: TENANT,
      operation: 'listComments',
      payload: { ticketId: 'ticket-1000' },
    });
    expect(comments.ok).toBe(true);
    if (!comments.ok || comments.result.kind !== 'externalRefs') return;
    expect(comments.result.externalRefs.some((ref) => ref.externalId === commentId)).toBe(true);

    const createdTag = await adapter.execute({
      tenantId: TENANT,
      operation: 'createTag',
      payload: { name: 'integration' },
    });
    expect(createdTag.ok).toBe(true);
    if (!createdTag.ok || createdTag.result.kind !== 'externalRef') return;
    const tagId = createdTag.result.externalRef.externalId;

    const tags = await adapter.execute({ tenantId: TENANT, operation: 'listTags' });
    expect(tags.ok).toBe(true);
    if (!tags.ok || tags.result.kind !== 'externalRefs') return;
    expect(tags.result.externalRefs.some((ref) => ref.externalId === tagId)).toBe(true);
  });

  it('supports knowledge article, SLA, and CSAT reads', async () => {
    const adapter = new InMemoryCustomerSupportAdapter({
      seed: InMemoryCustomerSupportAdapter.seedMinimal(TENANT),
    });

    const articles = await adapter.execute({
      tenantId: TENANT,
      operation: 'listKnowledgeArticles',
    });
    expect(articles.ok).toBe(true);
    if (!articles.ok || articles.result.kind !== 'documents') return;
    const documentId = articles.result.documents[0]!.documentId;

    const article = await adapter.execute({
      tenantId: TENANT,
      operation: 'getKnowledgeArticle',
      payload: { documentId },
    });
    expect(article.ok).toBe(true);
    if (!article.ok || article.result.kind !== 'document') return;
    expect(article.result.document.documentId).toBe(documentId);

    const sla = await adapter.execute({
      tenantId: TENANT,
      operation: 'getSLA',
      payload: { ticketId: 'ticket-1000' },
    });
    expect(sla.ok).toBe(true);
    if (!sla.ok || sla.result.kind !== 'externalRef') return;
    expect(sla.result.externalRef.externalId).toBe('sla-1000');

    const csat = await adapter.execute({
      tenantId: TENANT,
      operation: 'listCustomerSatisfactionRatings',
    });
    expect(csat.ok).toBe(true);
    if (!csat.ok || csat.result.kind !== 'externalRefs') return;
    expect(csat.result.externalRefs).toHaveLength(1);
  });

  it('returns validation errors when required payload fields are missing', async () => {
    const adapter = new InMemoryCustomerSupportAdapter({
      seed: InMemoryCustomerSupportAdapter.seedMinimal(TENANT),
    });

    const getMissingTicketId = await adapter.execute({
      tenantId: TENANT,
      operation: 'getTicket',
      payload: {},
    });
    expect(getMissingTicketId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'ticketId is required for getTicket.',
    });

    const assignMissingAssigneeId = await adapter.execute({
      tenantId: TENANT,
      operation: 'assignTicket',
      payload: { ticketId: 'ticket-1000' },
    });
    expect(assignMissingAssigneeId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'assigneeId is required for assignTicket.',
    });
  });
});
