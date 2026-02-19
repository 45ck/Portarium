import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryCrmSalesAdapter } from './in-memory-crm-sales-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryCrmSalesAdapter integration', () => {
  it('supports contact create/get/update/list flow', async () => {
    const adapter = new InMemoryCrmSalesAdapter({
      seed: InMemoryCrmSalesAdapter.seedMinimal(TENANT),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createContact',
      payload: { displayName: 'Jane Doe', email: 'jane@example.com' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'party') return;
    const partyId = created.result.party.partyId;

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getContact',
      payload: { partyId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'party') return;
    expect(fetched.result.party.partyId).toBe(partyId);

    const updated = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateContact',
      payload: { partyId, displayName: 'Jane D.' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'party') return;
    expect(updated.result.party.displayName).toBe('Jane D.');

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listContacts' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'parties') return;
    expect(listed.result.parties.some((party) => party.partyId === partyId)).toBe(true);
  });

  it('supports company and opportunity flows with pipeline reads', async () => {
    const adapter = new InMemoryCrmSalesAdapter({
      seed: InMemoryCrmSalesAdapter.seedMinimal(TENANT),
    });

    const company = await adapter.execute({
      tenantId: TENANT,
      operation: 'createCompany',
      payload: { displayName: 'Acme Corp' },
    });
    expect(company.ok).toBe(true);
    if (!company.ok || company.result.kind !== 'party') return;

    const opportunity = await adapter.execute({
      tenantId: TENANT,
      operation: 'createOpportunity',
      payload: { name: 'Acme Expansion', stage: 'proposal', amount: 45000, currencyCode: 'USD' },
    });
    expect(opportunity.ok).toBe(true);
    if (!opportunity.ok || opportunity.result.kind !== 'opportunity') return;
    const opportunityId = opportunity.result.opportunity.opportunityId;

    const moved = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateOpportunityStage',
      payload: { opportunityId, stage: 'closed_won' },
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok || moved.result.kind !== 'opportunity') return;
    expect(moved.result.opportunity.stage).toBe('closed_won');

    const listedOpportunities = await adapter.execute({
      tenantId: TENANT,
      operation: 'listOpportunities',
    });
    expect(listedOpportunities.ok).toBe(true);
    if (!listedOpportunities.ok || listedOpportunities.result.kind !== 'opportunities') return;
    expect(
      listedOpportunities.result.opportunities.some((item) => item.opportunityId === opportunityId),
    ).toBe(true);

    const pipelines = await adapter.execute({ tenantId: TENANT, operation: 'listPipelines' });
    expect(pipelines.ok).toBe(true);
    if (!pipelines.ok || pipelines.result.kind !== 'externalRefs') return;
    expect(pipelines.result.externalRefs).toHaveLength(1);
  });

  it('supports activity and note creation flows', async () => {
    const adapter = new InMemoryCrmSalesAdapter({
      seed: InMemoryCrmSalesAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const activity = await adapter.execute({
      tenantId: TENANT,
      operation: 'createActivity',
      payload: { title: 'Prepare demo agenda', status: 'in_progress' },
    });
    expect(activity.ok).toBe(true);
    if (!activity.ok || activity.result.kind !== 'task') return;
    expect(activity.result.task.status).toBe('in_progress');
    const activityId = activity.result.task.canonicalTaskId;

    const activities = await adapter.execute({ tenantId: TENANT, operation: 'listActivities' });
    expect(activities.ok).toBe(true);
    if (!activities.ok || activities.result.kind !== 'tasks') return;
    expect(activities.result.tasks.some((task) => task.canonicalTaskId === activityId)).toBe(true);

    const note = await adapter.execute({
      tenantId: TENANT,
      operation: 'createNote',
      payload: { title: 'Meeting recap', mimeType: 'text/plain' },
    });
    expect(note.ok).toBe(true);
    if (!note.ok || note.result.kind !== 'document') return;
    expect(note.result.document.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
    const noteId = note.result.document.documentId;

    const notes = await adapter.execute({ tenantId: TENANT, operation: 'listNotes' });
    expect(notes.ok).toBe(true);
    if (!notes.ok || notes.result.kind !== 'documents') return;
    expect(notes.result.documents.some((doc) => doc.documentId === noteId)).toBe(true);
  });

  it('returns validation errors for missing required identifiers', async () => {
    const adapter = new InMemoryCrmSalesAdapter({
      seed: InMemoryCrmSalesAdapter.seedMinimal(TENANT),
    });

    const missingContactId = await adapter.execute({
      tenantId: TENANT,
      operation: 'getContact',
      payload: {},
    });
    expect(missingContactId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'partyId is required for getContact.',
    });

    const missingStage = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateOpportunityStage',
      payload: { opportunityId: 'opportunity-1000' },
    });
    expect(missingStage).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'stage is required for updateOpportunityStage.',
    });
  });
});
