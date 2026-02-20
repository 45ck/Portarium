import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryCrmSalesAdapter } from './in-memory-crm-sales-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryCrmSalesAdapter', () => {
  it('returns tenant-scoped contacts', async () => {
    const seedA = InMemoryCrmSalesAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryCrmSalesAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryCrmSalesAdapter({
      seed: {
        ...seedA,
        contacts: [...seedA.contacts!, ...seedB.contacts!],
      },
    });

    const result = await adapter.execute({ tenantId: TENANT_A, operation: 'listContacts' });
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'parties') return;
    expect(result.result.parties).toHaveLength(1);
    expect(result.result.parties[0]?.tenantId).toBe(TENANT_A);
  });

  it('creates, updates, and fetches contacts', async () => {
    const adapter = new InMemoryCrmSalesAdapter({
      seed: InMemoryCrmSalesAdapter.seedMinimal(TENANT_A),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createContact',
      payload: { displayName: 'Alice Smith', email: 'alice@example.com' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'party') return;
    const partyId = created.result.party.partyId;

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateContact',
      payload: { partyId, displayName: 'Alice Jones' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'party') return;
    expect(updated.result.party.displayName).toBe('Alice Jones');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getContact',
      payload: { partyId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'party') return;
    expect(fetched.result.party.partyId).toBe(partyId);
  });

  it('supports company list/get/create flows', async () => {
    const adapter = new InMemoryCrmSalesAdapter({
      seed: InMemoryCrmSalesAdapter.seedMinimal(TENANT_A),
    });

    const companies = await adapter.execute({ tenantId: TENANT_A, operation: 'listCompanies' });
    expect(companies.ok).toBe(true);
    if (!companies.ok || companies.result.kind !== 'parties') return;
    expect(companies.result.parties).toHaveLength(1);

    const partyId = companies.result.parties[0]!.partyId;
    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getCompany',
      payload: { partyId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'party') return;
    expect(fetched.result.party.partyId).toBe(partyId);

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createCompany',
      payload: { displayName: 'Northwind Traders' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'party') return;
    expect(created.result.party.roles).toContain('org');
  });

  it('supports opportunity create/get/list and stage updates', async () => {
    const adapter = new InMemoryCrmSalesAdapter({
      seed: InMemoryCrmSalesAdapter.seedMinimal(TENANT_A),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createOpportunity',
      payload: { name: 'Expansion Deal', stage: 'proposal', amount: 32000, currencyCode: 'USD' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'opportunity') return;
    const opportunityId = created.result.opportunity.opportunityId;

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateOpportunityStage',
      payload: { opportunityId, stage: 'closed_won' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'opportunity') return;
    expect(updated.result.opportunity.stage).toBe('closed_won');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getOpportunity',
      payload: { opportunityId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'opportunity') return;
    expect(fetched.result.opportunity.opportunityId).toBe(opportunityId);

    const listed = await adapter.execute({ tenantId: TENANT_A, operation: 'listOpportunities' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'opportunities') return;
    expect(listed.result.opportunities.some((item) => item.opportunityId === opportunityId)).toBe(
      true,
    );
  });

  it('supports pipeline, activity, and note operations', async () => {
    const adapter = new InMemoryCrmSalesAdapter({
      seed: InMemoryCrmSalesAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const pipelines = await adapter.execute({ tenantId: TENANT_A, operation: 'listPipelines' });
    expect(pipelines.ok).toBe(true);
    if (!pipelines.ok || pipelines.result.kind !== 'externalRefs') return;
    expect(pipelines.result.externalRefs).toHaveLength(1);

    const activities = await adapter.execute({ tenantId: TENANT_A, operation: 'listActivities' });
    expect(activities.ok).toBe(true);
    if (!activities.ok || activities.result.kind !== 'tasks') return;
    expect(activities.result.tasks).toHaveLength(1);

    const createdActivity = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createActivity',
      payload: { title: 'Prepare pricing follow-up', status: 'in_progress' },
    });
    expect(createdActivity.ok).toBe(true);
    if (!createdActivity.ok || createdActivity.result.kind !== 'task') return;
    expect(createdActivity.result.task.status).toBe('in_progress');

    const notes = await adapter.execute({ tenantId: TENANT_A, operation: 'listNotes' });
    expect(notes.ok).toBe(true);
    if (!notes.ok || notes.result.kind !== 'documents') return;
    expect(notes.result.documents).toHaveLength(1);

    const createdNote = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createNote',
      payload: { title: 'Customer feedback', mimeType: 'text/markdown' },
    });
    expect(createdNote.ok).toBe(true);
    if (!createdNote.ok || createdNote.result.kind !== 'document') return;
    expect(createdNote.result.document.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryCrmSalesAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listContacts',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported CrmSales operation: bogusOperation.',
    });
  });
});
