import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryAdsPlatformsAdapter } from './in-memory-ads-platforms-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryAdsPlatformsAdapter integration', () => {
  it('supports campaign lifecycle and campaign stats operations', async () => {
    const adapter = new InMemoryAdsPlatformsAdapter({
      seed: InMemoryAdsPlatformsAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createCampaign',
      payload: { name: 'Integration Campaign', channelType: 'search' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'campaign') return;
    const campaignId = created.result.campaign.campaignId;

    const updated = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateCampaign',
      payload: { campaignId, name: 'Integration Campaign Updated' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'campaign') return;
    expect(updated.result.campaign.name).toBe('Integration Campaign Updated');

    const paused = await adapter.execute({
      tenantId: TENANT,
      operation: 'pauseCampaign',
      payload: { campaignId },
    });
    expect(paused.ok).toBe(true);
    if (!paused.ok || paused.result.kind !== 'campaign') return;
    expect(paused.result.campaign.status).toBe('paused');

    const stats = await adapter.execute({
      tenantId: TENANT,
      operation: 'getCampaignStats',
      payload: { campaignId, period: 'last_7_days' },
    });
    expect(stats.ok).toBe(true);
    if (!stats.ok || stats.result.kind !== 'externalRef') return;
    expect(stats.result.externalRef.displayLabel).toContain('last_7_days');
    expect(stats.result.externalRef.deepLinkUrl).toContain('2026-02-19T00%3A00%3A00.000Z');
  });

  it('supports ad group and ad lifecycle with stats retrieval', async () => {
    const adapter = new InMemoryAdsPlatformsAdapter({
      seed: InMemoryAdsPlatformsAdapter.seedMinimal(TENANT),
    });

    const createdAdGroup = await adapter.execute({
      tenantId: TENANT,
      operation: 'createAdGroup',
      payload: { name: 'Integration Segment' },
    });
    expect(createdAdGroup.ok).toBe(true);
    if (!createdAdGroup.ok || createdAdGroup.result.kind !== 'externalRef') return;
    const adGroupId = createdAdGroup.result.externalRef.externalId;

    const createdAd = await adapter.execute({
      tenantId: TENANT,
      operation: 'createAd',
      payload: { headline: 'Integration Ad Headline' },
    });
    expect(createdAd.ok).toBe(true);
    if (!createdAd.ok || createdAd.result.kind !== 'externalRef') return;
    const adId = createdAd.result.externalRef.externalId;

    const adGroupStats = await adapter.execute({
      tenantId: TENANT,
      operation: 'getAdGroupStats',
      payload: { adGroupId },
    });
    expect(adGroupStats.ok).toBe(true);
    if (!adGroupStats.ok || adGroupStats.result.kind !== 'externalRef') return;
    expect(adGroupStats.result.externalRef.externalType).toBe('performance_stats');

    const adStats = await adapter.execute({
      tenantId: TENANT,
      operation: 'getAdStats',
      payload: { adId },
    });
    expect(adStats.ok).toBe(true);
    if (!adStats.ok || adStats.result.kind !== 'externalRef') return;
    expect(adStats.result.externalRef.externalType).toBe('performance_stats');

    const ads = await adapter.execute({ tenantId: TENANT, operation: 'listAds' });
    expect(ads.ok).toBe(true);
    if (!ads.ok || ads.result.kind !== 'externalRefs') return;
    expect(ads.result.externalRefs.some((entry) => entry.externalId === adId)).toBe(true);
  });

  it('supports audience, budget, and keyword operations', async () => {
    const adapter = new InMemoryAdsPlatformsAdapter({
      seed: InMemoryAdsPlatformsAdapter.seedMinimal(TENANT),
    });

    const createdAudience = await adapter.execute({
      tenantId: TENANT,
      operation: 'createAudience',
      payload: { name: 'Integration Audience' },
    });
    expect(createdAudience.ok).toBe(true);
    if (!createdAudience.ok || createdAudience.result.kind !== 'externalRef') return;
    const audienceId = createdAudience.result.externalRef.externalId;

    const audiences = await adapter.execute({ tenantId: TENANT, operation: 'listAudiences' });
    expect(audiences.ok).toBe(true);
    if (!audiences.ok || audiences.result.kind !== 'externalRefs') return;
    expect(audiences.result.externalRefs.some((entry) => entry.externalId === audienceId)).toBe(
      true,
    );

    const budget = await adapter.execute({
      tenantId: TENANT,
      operation: 'getBudget',
      payload: { budgetId: 'budget-1000' },
    });
    expect(budget.ok).toBe(true);
    if (!budget.ok || budget.result.kind !== 'externalRef') return;

    const updatedBudget = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateBudget',
      payload: { budgetId: 'budget-1000', amount: 2500 },
    });
    expect(updatedBudget.ok).toBe(true);
    if (!updatedBudget.ok || updatedBudget.result.kind !== 'externalRef') return;
    expect(updatedBudget.result.externalRef.displayLabel).toContain('2500.00');

    const keywords = await adapter.execute({ tenantId: TENANT, operation: 'listKeywords' });
    expect(keywords.ok).toBe(true);
    if (!keywords.ok || keywords.result.kind !== 'externalRefs') return;
    expect(keywords.result.externalRefs).toHaveLength(1);
  });

  it('returns validation errors for missing required payload fields', async () => {
    const adapter = new InMemoryAdsPlatformsAdapter({
      seed: InMemoryAdsPlatformsAdapter.seedMinimal(TENANT),
    });

    const missingCampaignId = await adapter.execute({
      tenantId: TENANT,
      operation: 'getCampaign',
      payload: {},
    });
    expect(missingCampaignId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'campaignId is required for getCampaign.',
    });

    const missingAdGroupId = await adapter.execute({
      tenantId: TENANT,
      operation: 'getAdGroupStats',
      payload: {},
    });
    expect(missingAdGroupId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'adGroupId is required for getAdGroupStats.',
    });

    const missingBudgetId = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateBudget',
      payload: { amount: 10 },
    });
    expect(missingBudgetId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'budgetId is required for updateBudget.',
    });
  });
});
