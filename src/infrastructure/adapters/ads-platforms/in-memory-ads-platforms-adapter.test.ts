import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryAdsPlatformsAdapter } from './in-memory-ads-platforms-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryAdsPlatformsAdapter', () => {
  it('returns tenant-scoped campaigns', async () => {
    const seedA = InMemoryAdsPlatformsAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryAdsPlatformsAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryAdsPlatformsAdapter({
      seed: {
        ...seedA,
        campaigns: [...seedA.campaigns!, ...seedB.campaigns!],
      },
    });

    const listed = await adapter.execute({ tenantId: TENANT_A, operation: 'listCampaigns' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'campaigns') return;
    expect(listed.result.campaigns).toHaveLength(1);
    expect(listed.result.campaigns[0]?.tenantId).toBe(TENANT_A);
  });

  it('supports campaign create/update/pause/get lifecycle', async () => {
    const adapter = new InMemoryAdsPlatformsAdapter({
      seed: InMemoryAdsPlatformsAdapter.seedMinimal(TENANT_A),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createCampaign',
      payload: { name: 'Expansion Campaign', channelType: 'display' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'campaign') return;
    const campaignId = created.result.campaign.campaignId;

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateCampaign',
      payload: { campaignId, name: 'Expansion Campaign Updated' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'campaign') return;
    expect(updated.result.campaign.name).toBe('Expansion Campaign Updated');

    const paused = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'pauseCampaign',
      payload: { campaignId },
    });
    expect(paused.ok).toBe(true);
    if (!paused.ok || paused.result.kind !== 'campaign') return;
    expect(paused.result.campaign.status).toBe('paused');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getCampaign',
      payload: { campaignId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'campaign') return;
    expect(fetched.result.campaign.campaignId).toBe(campaignId);
  });

  it('supports ad group and ad operations', async () => {
    const adapter = new InMemoryAdsPlatformsAdapter({
      seed: InMemoryAdsPlatformsAdapter.seedMinimal(TENANT_A),
    });

    const adGroup = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createAdGroup',
      payload: { name: 'New Segment Group' },
    });
    expect(adGroup.ok).toBe(true);
    if (!adGroup.ok || adGroup.result.kind !== 'externalRef') return;
    const adGroupId = adGroup.result.externalRef.externalId;

    const fetchedAdGroup = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getAdGroup',
      payload: { adGroupId },
    });
    expect(fetchedAdGroup.ok).toBe(true);
    if (!fetchedAdGroup.ok || fetchedAdGroup.result.kind !== 'externalRef') return;
    expect(fetchedAdGroup.result.externalRef.externalId).toBe(adGroupId);

    const ad = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createAd',
      payload: { headline: 'Automate your operations' },
    });
    expect(ad.ok).toBe(true);
    if (!ad.ok || ad.result.kind !== 'externalRef') return;
    const adId = ad.result.externalRef.externalId;

    const fetchedAd = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getAd',
      payload: { adId },
    });
    expect(fetchedAd.ok).toBe(true);
    if (!fetchedAd.ok || fetchedAd.result.kind !== 'externalRef') return;
    expect(fetchedAd.result.externalRef.externalId).toBe(adId);

    const ads = await adapter.execute({ tenantId: TENANT_A, operation: 'listAds' });
    expect(ads.ok).toBe(true);
    if (!ads.ok || ads.result.kind !== 'externalRefs') return;
    expect(ads.result.externalRefs.some((item) => item.externalId === adId)).toBe(true);
  });

  it('supports stats, audience, budget, and keyword operations', async () => {
    const adapter = new InMemoryAdsPlatformsAdapter({
      seed: InMemoryAdsPlatformsAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const campaignStats = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getCampaignStats',
      payload: { campaignId: 'campaign-1000', period: 'last_7_days' },
    });
    expect(campaignStats.ok).toBe(true);
    if (!campaignStats.ok || campaignStats.result.kind !== 'externalRef') return;
    expect(campaignStats.result.externalRef.displayLabel).toContain('last_7_days');

    const adGroupStats = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getAdGroupStats',
      payload: { adGroupId: 'ad-group-1000' },
    });
    expect(adGroupStats.ok).toBe(true);
    if (!adGroupStats.ok || adGroupStats.result.kind !== 'externalRef') return;
    expect(adGroupStats.result.externalRef.externalType).toBe('performance_stats');

    const adStats = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getAdStats',
      payload: { adId: 'ad-1000' },
    });
    expect(adStats.ok).toBe(true);
    if (!adStats.ok || adStats.result.kind !== 'externalRef') return;
    expect(adStats.result.externalRef.deepLinkUrl).toContain('2026-02-19T00%3A00%3A00.000Z');

    const createdAudience = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createAudience',
      payload: { name: 'Engineering Directors' },
    });
    expect(createdAudience.ok).toBe(true);
    if (!createdAudience.ok || createdAudience.result.kind !== 'externalRef') return;
    const audienceId = createdAudience.result.externalRef.externalId;

    const audiences = await adapter.execute({ tenantId: TENANT_A, operation: 'listAudiences' });
    expect(audiences.ok).toBe(true);
    if (!audiences.ok || audiences.result.kind !== 'externalRefs') return;
    expect(audiences.result.externalRefs.some((item) => item.externalId === audienceId)).toBe(true);

    const budget = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getBudget',
      payload: { budgetId: 'budget-1000' },
    });
    expect(budget.ok).toBe(true);
    if (!budget.ok || budget.result.kind !== 'externalRef') return;

    const updatedBudget = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateBudget',
      payload: { budgetId: 'budget-1000', amount: 1500 },
    });
    expect(updatedBudget.ok).toBe(true);
    if (!updatedBudget.ok || updatedBudget.result.kind !== 'externalRef') return;
    expect(updatedBudget.result.externalRef.displayLabel).toContain('1500.00');

    const keywords = await adapter.execute({ tenantId: TENANT_A, operation: 'listKeywords' });
    expect(keywords.ok).toBe(true);
    if (!keywords.ok || keywords.result.kind !== 'externalRefs') return;
    expect(keywords.result.externalRefs.length).toBeGreaterThan(0);
  });

  it('returns validation errors for required payload fields', async () => {
    const adapter = new InMemoryAdsPlatformsAdapter({
      seed: InMemoryAdsPlatformsAdapter.seedMinimal(TENANT_A),
    });

    const missingCampaignId = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'pauseCampaign',
      payload: {},
    });
    expect(missingCampaignId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'campaignId is required for pauseCampaign.',
    });

    const missingAmount = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateBudget',
      payload: { budgetId: 'budget-1000' },
    });
    expect(missingAmount).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'amount must be a non-negative number for updateBudget.',
    });
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryAdsPlatformsAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listCampaigns',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported AdsPlatforms operation: bogusOperation.',
    });
  });
});
