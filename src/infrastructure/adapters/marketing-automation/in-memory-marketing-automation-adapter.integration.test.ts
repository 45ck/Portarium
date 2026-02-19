import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryMarketingAutomationAdapter } from './in-memory-marketing-automation-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryMarketingAutomationAdapter integration', () => {
  it('supports contact lifecycle and list membership operations', async () => {
    const adapter = new InMemoryMarketingAutomationAdapter({
      seed: InMemoryMarketingAutomationAdapter.seedMinimal(TENANT),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createContact',
      payload: { displayName: 'Integration Lead', email: 'integration@example.com' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'party') return;
    const contactId = created.result.party.partyId;

    const updated = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateContact',
      payload: { contactId, displayName: 'Integration Lead Updated' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'party') return;
    expect(updated.result.party.displayName).toBe('Integration Lead Updated');

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getContact',
      payload: { contactId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'party') return;
    expect(fetched.result.party.partyId).toBe(contactId);

    const add = await adapter.execute({
      tenantId: TENANT,
      operation: 'addContactToList',
      payload: { contactId, listId: 'list-1000' },
    });
    expect(add.ok).toBe(true);
    if (!add.ok || add.result.kind !== 'accepted') return;

    const remove = await adapter.execute({
      tenantId: TENANT,
      operation: 'removeContactFromList',
      payload: { contactId, listId: 'list-1000' },
    });
    expect(remove.ok).toBe(true);
    if (!remove.ok || remove.result.kind !== 'accepted') return;

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listContacts' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'parties') return;
    expect(listed.result.parties.some((party) => party.partyId === contactId)).toBe(true);
  });

  it('supports campaign lifecycle and campaign stats operations', async () => {
    const adapter = new InMemoryMarketingAutomationAdapter({
      seed: InMemoryMarketingAutomationAdapter.seedMinimal(TENANT),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createCampaign',
      payload: { name: 'Integration Campaign', channelType: 'email' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'campaign') return;
    const campaignId = created.result.campaign.campaignId;

    const sent = await adapter.execute({
      tenantId: TENANT,
      operation: 'sendCampaign',
      payload: { campaignId },
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok || sent.result.kind !== 'campaign') return;
    expect(sent.result.campaign.status).toBe('active');

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getCampaign',
      payload: { campaignId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'campaign') return;
    expect(fetched.result.campaign.campaignId).toBe(campaignId);

    const stats = await adapter.execute({
      tenantId: TENANT,
      operation: 'getCampaignStats',
      payload: { campaignId },
    });
    expect(stats.ok).toBe(true);
    if (!stats.ok || stats.result.kind !== 'externalRef') return;
    expect(stats.result.externalRef.externalType).toBe('campaign_stats');

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listCampaigns' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'campaigns') return;
    expect(listed.result.campaigns.some((campaign) => campaign.campaignId === campaignId)).toBe(true);
  });

  it('supports automation and form submission operations', async () => {
    const adapter = new InMemoryMarketingAutomationAdapter({
      seed: InMemoryMarketingAutomationAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const automations = await adapter.execute({ tenantId: TENANT, operation: 'listAutomations' });
    expect(automations.ok).toBe(true);
    if (!automations.ok || automations.result.kind !== 'externalRefs') return;
    const automationId = automations.result.externalRefs[0]!.externalId;

    const automation = await adapter.execute({
      tenantId: TENANT,
      operation: 'getAutomation',
      payload: { automationId },
    });
    expect(automation.ok).toBe(true);
    if (!automation.ok || automation.result.kind !== 'externalRef') return;
    expect(automation.result.externalRef.externalId).toBe(automationId);

    const triggered = await adapter.execute({
      tenantId: TENANT,
      operation: 'triggerAutomation',
      payload: { automationId },
    });
    expect(triggered.ok).toBe(true);
    if (!triggered.ok || triggered.result.kind !== 'externalRef') return;
    expect(triggered.result.externalRef.externalType).toBe('automation_run');
    expect(triggered.result.externalRef.deepLinkUrl).toContain('2026-02-19T00%3A00%3A00.000Z');

    const forms = await adapter.execute({ tenantId: TENANT, operation: 'listForms' });
    expect(forms.ok).toBe(true);
    if (!forms.ok || forms.result.kind !== 'externalRefs') return;
    const formId = forms.result.externalRefs[0]!.externalId;

    const submissions = await adapter.execute({
      tenantId: TENANT,
      operation: 'getFormSubmissions',
      payload: { formId },
    });
    expect(submissions.ok).toBe(true);
    if (!submissions.ok || submissions.result.kind !== 'externalRefs') return;
    expect(submissions.result.externalRefs).toHaveLength(1);
  });

  it('returns validation errors for missing required fields', async () => {
    const adapter = new InMemoryMarketingAutomationAdapter({
      seed: InMemoryMarketingAutomationAdapter.seedMinimal(TENANT),
    });

    const missingCampaignId = await adapter.execute({
      tenantId: TENANT,
      operation: 'sendCampaign',
      payload: {},
    });
    expect(missingCampaignId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'campaignId is required for sendCampaign.',
    });

    const missingAutomationId = await adapter.execute({
      tenantId: TENANT,
      operation: 'triggerAutomation',
      payload: {},
    });
    expect(missingAutomationId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'automationId is required for triggerAutomation.',
    });

    const missingFormId = await adapter.execute({
      tenantId: TENANT,
      operation: 'getFormSubmissions',
      payload: {},
    });
    expect(missingFormId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'formId is required for getFormSubmissions.',
    });
  });
});
