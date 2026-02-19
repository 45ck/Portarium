import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryMarketingAutomationAdapter } from './in-memory-marketing-automation-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryMarketingAutomationAdapter', () => {
  it('returns tenant-scoped contacts', async () => {
    const seedA = InMemoryMarketingAutomationAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryMarketingAutomationAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryMarketingAutomationAdapter({
      seed: {
        ...seedA,
        contacts: [...seedA.contacts!, ...seedB.contacts!],
      },
    });

    const listed = await adapter.execute({ tenantId: TENANT_A, operation: 'listContacts' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'parties') return;
    expect(listed.result.parties).toHaveLength(1);
    expect(listed.result.parties[0]?.tenantId).toBe(TENANT_A);
  });

  it('supports contact create/update/get flows', async () => {
    const adapter = new InMemoryMarketingAutomationAdapter({
      seed: InMemoryMarketingAutomationAdapter.seedMinimal(TENANT_A),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createContact',
      payload: { displayName: 'Alice Campaign', email: 'alice@example.com' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'party') return;
    const contactId = created.result.party.partyId;

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateContact',
      payload: { contactId, displayName: 'Alice Updated' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'party') return;
    expect(updated.result.party.displayName).toBe('Alice Updated');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getContact',
      payload: { contactId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'party') return;
    expect(fetched.result.party.partyId).toBe(contactId);
  });

  it('supports list membership add/remove flows', async () => {
    const adapter = new InMemoryMarketingAutomationAdapter({
      seed: InMemoryMarketingAutomationAdapter.seedMinimal(TENANT_A),
    });

    const list = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getList',
      payload: { listId: 'list-1000' },
    });
    expect(list.ok).toBe(true);
    if (!list.ok || list.result.kind !== 'externalRef') return;
    expect(list.result.externalRef.externalId).toBe('list-1000');

    const add = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'addContactToList',
      payload: { contactId: 'contact-1000', listId: 'list-1000' },
    });
    expect(add).toEqual({
      ok: true,
      result: { kind: 'accepted', operation: 'addContactToList' },
    });

    const remove = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'removeContactFromList',
      payload: { contactId: 'contact-1000', listId: 'list-1000' },
    });
    expect(remove).toEqual({
      ok: true,
      result: { kind: 'accepted', operation: 'removeContactFromList' },
    });
  });

  it('supports campaign create/send/get/list/stats flows', async () => {
    const adapter = new InMemoryMarketingAutomationAdapter({
      seed: InMemoryMarketingAutomationAdapter.seedMinimal(TENANT_A),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createCampaign',
      payload: { name: 'Spring Outreach', channelType: 'email' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'campaign') return;
    const campaignId = created.result.campaign.campaignId;

    const sent = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'sendCampaign',
      payload: { campaignId },
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok || sent.result.kind !== 'campaign') return;
    expect(sent.result.campaign.status).toBe('active');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getCampaign',
      payload: { campaignId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'campaign') return;
    expect(fetched.result.campaign.campaignId).toBe(campaignId);

    const listed = await adapter.execute({ tenantId: TENANT_A, operation: 'listCampaigns' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'campaigns') return;
    expect(listed.result.campaigns.some((campaign) => campaign.campaignId === campaignId)).toBe(true);

    const stats = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getCampaignStats',
      payload: { campaignId },
    });
    expect(stats.ok).toBe(true);
    if (!stats.ok || stats.result.kind !== 'externalRef') return;
    expect(stats.result.externalRef.externalType).toBe('campaign_stats');
  });

  it('supports automation and form operations', async () => {
    const adapter = new InMemoryMarketingAutomationAdapter({
      seed: InMemoryMarketingAutomationAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const automations = await adapter.execute({ tenantId: TENANT_A, operation: 'listAutomations' });
    expect(automations.ok).toBe(true);
    if (!automations.ok || automations.result.kind !== 'externalRefs') return;
    expect(automations.result.externalRefs).toHaveLength(1);
    const automationId = automations.result.externalRefs[0]!.externalId;

    const automation = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getAutomation',
      payload: { automationId },
    });
    expect(automation.ok).toBe(true);
    if (!automation.ok || automation.result.kind !== 'externalRef') return;
    expect(automation.result.externalRef.externalId).toBe(automationId);

    const triggered = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'triggerAutomation',
      payload: { automationId },
    });
    expect(triggered.ok).toBe(true);
    if (!triggered.ok || triggered.result.kind !== 'externalRef') return;
    expect(triggered.result.externalRef.externalType).toBe('automation_run');
    expect(triggered.result.externalRef.deepLinkUrl).toContain('2026-02-19T00%3A00%3A00.000Z');

    const forms = await adapter.execute({ tenantId: TENANT_A, operation: 'listForms' });
    expect(forms.ok).toBe(true);
    if (!forms.ok || forms.result.kind !== 'externalRefs') return;
    expect(forms.result.externalRefs).toHaveLength(1);

    const submissions = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getFormSubmissions',
      payload: { formId: forms.result.externalRefs[0]!.externalId },
    });
    expect(submissions.ok).toBe(true);
    if (!submissions.ok || submissions.result.kind !== 'externalRefs') return;
    expect(submissions.result.externalRefs.length).toBeGreaterThan(0);
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryMarketingAutomationAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listContacts',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported MarketingAutomation operation: bogusOperation.',
    });
  });
});
