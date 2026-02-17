import { describe, expect, it } from 'vitest';

import { CampaignParseError, parseCampaignV1 } from './campaign-v1.js';

describe('parseCampaignV1', () => {
  const valid = {
    campaignId: 'camp-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    name: 'Spring Sale',
    status: 'active',
    channelType: 'email',
    startDateIso: '2026-03-01T00:00:00.000Z',
    endDateIso: '2026-03-31T23:59:59.000Z',
    externalRefs: [
      {
        sorName: 'hubspot',
        portFamily: 'MarketingAutomation',
        externalId: 'hs-camp-1',
        externalType: 'Campaign',
      },
    ],
  };

  it('parses a full CampaignV1 with all fields', () => {
    const campaign = parseCampaignV1(valid);
    expect(campaign.campaignId).toBe('camp-1');
    expect(campaign.name).toBe('Spring Sale');
    expect(campaign.status).toBe('active');
    expect(campaign.channelType).toBe('email');
    expect(campaign.startDateIso).toBe('2026-03-01T00:00:00.000Z');
    expect(campaign.endDateIso).toBe('2026-03-31T23:59:59.000Z');
    expect(campaign.externalRefs).toHaveLength(1);
  });

  it('parses a minimal CampaignV1 (required fields only)', () => {
    const campaign = parseCampaignV1({
      campaignId: 'camp-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      name: 'Q4 Push',
      status: 'draft',
    });
    expect(campaign.campaignId).toBe('camp-2');
    expect(campaign.channelType).toBeUndefined();
    expect(campaign.startDateIso).toBeUndefined();
    expect(campaign.endDateIso).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseCampaignV1('nope')).toThrow(CampaignParseError);
    expect(() => parseCampaignV1(null)).toThrow(CampaignParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseCampaignV1({ ...valid, name: '' })).toThrow(/name/);
  });

  it('rejects invalid status', () => {
    expect(() => parseCampaignV1({ ...valid, status: 'archived' })).toThrow(/status/);
  });
});
