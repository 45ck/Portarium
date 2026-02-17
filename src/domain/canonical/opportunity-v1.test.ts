import { describe, expect, it } from 'vitest';

import { OpportunityParseError, parseOpportunityV1 } from './opportunity-v1.js';

describe('parseOpportunityV1', () => {
  const valid = {
    opportunityId: 'opp-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    name: 'Enterprise Deal',
    stage: 'negotiation',
    amount: 50000,
    currencyCode: 'USD',
    closeDate: '2026-06-30',
    probability: 75,
    externalRefs: [
      {
        sorName: 'salesforce',
        portFamily: 'CrmSales',
        externalId: 'sf-opp-1',
        externalType: 'Opportunity',
      },
    ],
  };

  it('parses a full OpportunityV1 with all fields', () => {
    const opp = parseOpportunityV1(valid);
    expect(opp.opportunityId).toBe('opp-1');
    expect(opp.name).toBe('Enterprise Deal');
    expect(opp.stage).toBe('negotiation');
    expect(opp.amount).toBe(50000);
    expect(opp.probability).toBe(75);
    expect(opp.externalRefs).toHaveLength(1);
  });

  it('parses a minimal OpportunityV1 (required fields only)', () => {
    const opp = parseOpportunityV1({
      opportunityId: 'opp-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      name: 'Small Deal',
      stage: 'prospecting',
    });
    expect(opp.opportunityId).toBe('opp-2');
    expect(opp.amount).toBeUndefined();
    expect(opp.currencyCode).toBeUndefined();
    expect(opp.closeDate).toBeUndefined();
    expect(opp.probability).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseOpportunityV1('nope')).toThrow(OpportunityParseError);
    expect(() => parseOpportunityV1(null)).toThrow(OpportunityParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseOpportunityV1({ ...valid, name: '' })).toThrow(/name/);
    expect(() => parseOpportunityV1({ ...valid, stage: 123 })).toThrow(/stage/);
  });

  it('rejects negative amount', () => {
    expect(() => parseOpportunityV1({ ...valid, amount: -100 })).toThrow(/amount/);
  });

  it('rejects probability out of range', () => {
    expect(() => parseOpportunityV1({ ...valid, probability: -1 })).toThrow(/probability/);
    expect(() => parseOpportunityV1({ ...valid, probability: 101 })).toThrow(/probability/);
  });
});
