import { describe, expect, it } from 'vitest';

import { ConsentParseError, parseConsentV1 } from './consent-v1.js';

describe('parseConsentV1', () => {
  const valid = {
    consentId: 'consent-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    partyId: 'party-1',
    purpose: 'marketing_email',
    channel: 'email',
    optInStatus: 'opted_in',
    capturedAtIso: '2026-02-20T00:00:00.000Z',
    suppressionEntries: [
      {
        listName: 'global-unsubscribes',
        addedAtIso: '2026-02-20T00:05:00.000Z',
        reason: 'user_request',
      },
    ],
    auditTrail: [
      {
        occurredAtIso: '2026-02-20T00:00:00.000Z',
        action: 'granted',
        optInStatus: 'opted_in',
        actorType: 'user',
        actorId: 'user-1',
        source: 'signup_form',
      },
    ],
    externalRefs: [
      {
        sorName: 'mailchimp',
        portFamily: 'MarketingAutomation',
        externalId: 'consent_123',
        externalType: 'consent',
      },
    ],
  };

  it('parses a full ConsentV1 payload', () => {
    const consent = parseConsentV1(valid);
    expect(consent.consentId).toBe('consent-1');
    expect(consent.partyId).toBe('party-1');
    expect(consent.optInStatus).toBe('opted_in');
    expect(consent.suppressionEntries).toHaveLength(1);
    expect(consent.auditTrail).toHaveLength(1);
    expect(consent.externalRefs).toHaveLength(1);
  });

  it('parses a minimal ConsentV1 payload', () => {
    const consent = parseConsentV1({
      consentId: 'consent-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      partyId: 'party-2',
      purpose: 'sms_notifications',
      channel: 'sms',
      optInStatus: 'unknown',
    });
    expect(consent.capturedAtIso).toBeUndefined();
    expect(consent.suppressionEntries).toBeUndefined();
    expect(consent.auditTrail).toBeUndefined();
  });

  it('rejects non-object payloads', () => {
    expect(() => parseConsentV1('nope')).toThrow(ConsentParseError);
    expect(() => parseConsentV1(null)).toThrow(ConsentParseError);
    expect(() => parseConsentV1([])).toThrow(ConsentParseError);
  });

  it('rejects invalid optInStatus', () => {
    expect(() => parseConsentV1({ ...valid, optInStatus: 'enabled' })).toThrow(/optInStatus/);
  });

  it('rejects empty suppressionEntries array', () => {
    expect(() => parseConsentV1({ ...valid, suppressionEntries: [] })).toThrow(
      /suppressionEntries/,
    );
  });

  it('rejects suppression entry expiry before add timestamp', () => {
    expect(() =>
      parseConsentV1({
        ...valid,
        suppressionEntries: [
          {
            listName: 'global-unsubscribes',
            addedAtIso: '2026-02-20T00:05:00.000Z',
            expiresAtIso: '2026-02-20T00:04:00.000Z',
          },
        ],
      }),
    ).toThrow(/expiresAtIso/);
  });

  it('rejects duplicate suppression list names', () => {
    expect(() =>
      parseConsentV1({
        ...valid,
        suppressionEntries: [
          {
            listName: 'Global-Unsubscribes',
            addedAtIso: '2026-02-20T00:05:00.000Z',
          },
          {
            listName: 'global-unsubscribes',
            addedAtIso: '2026-02-20T00:06:00.000Z',
          },
        ],
      }),
    ).toThrow(/duplicate listName/);
  });

  it('rejects non-chronological audit trail', () => {
    expect(() =>
      parseConsentV1({
        ...valid,
        auditTrail: [
          {
            occurredAtIso: '2026-02-20T00:10:00.000Z',
            action: 'updated',
            optInStatus: 'opted_out',
          },
          {
            occurredAtIso: '2026-02-20T00:00:00.000Z',
            action: 'granted',
            optInStatus: 'opted_in',
          },
        ],
      }),
    ).toThrow(/auditTrail/);
  });

  it('rejects when final audit state does not match top-level optInStatus', () => {
    expect(() =>
      parseConsentV1({
        ...valid,
        optInStatus: 'opted_out',
      }),
    ).toThrow(/final auditTrail entry/);
  });
});
