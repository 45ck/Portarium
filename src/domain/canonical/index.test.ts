import { describe, expect, it } from 'vitest';

import * as canonical from './index.js';

describe('canonical parser barrel', () => {
  it('re-exports every parser module and keeps the compatibility barrel private', () => {
    const expectedExports = [
      'parseAccountV1',
      'parseAssetV1',
      'parseCampaignV1',
      'parseConsentV1',
      'parseDocumentV1',
      'parseExternalObjectRef',
      'parseInvoiceV1',
      'parseOpportunityV1',
      'parseOrderV1',
      'parsePartyV1',
      'parsePaymentV1',
      'parsePrivacyPolicyV1',
      'parseProductV1',
      'parseSubscriptionV1',
      'parseCanonicalTaskV1',
      'parseTicketV1',
    ] as const;

    for (const exportName of expectedExports) {
      expect(canonical).toHaveProperty(exportName);
    }

    expect(canonical).not.toHaveProperty('CanonicalPartyId');
    expect(canonical).not.toHaveProperty('CanonicalConsentId');
    expect(canonical).not.toHaveProperty('CanonicalPrivacyPolicyId');
  });
});
