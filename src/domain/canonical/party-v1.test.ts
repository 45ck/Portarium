import { describe, expect, it } from 'vitest';

import { PartyParseError, parsePartyV1 } from './party-v1.js';

describe('parsePartyV1', () => {
  const valid = {
    partyId: 'party-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    displayName: 'Acme Corp',
    email: 'acme@example.com',
    phone: '+1-555-0100',
    roles: ['admin', 'billing'],
    externalRefs: [
      {
        sorName: 'salesforce',
        portFamily: 'CrmSales',
        externalId: 'sf-001',
        externalType: 'Account',
      },
    ],
  };

  it('parses a full PartyV1 with all fields', () => {
    const party = parsePartyV1(valid);
    expect(party.partyId).toBe('party-1');
    expect(party.tenantId).toBe('tenant-1');
    expect(party.schemaVersion).toBe(1);
    expect(party.displayName).toBe('Acme Corp');
    expect(party.email).toBe('acme@example.com');
    expect(party.phone).toBe('+1-555-0100');
    expect(party.roles).toEqual(['admin', 'billing']);
    expect(party.externalRefs).toHaveLength(1);
  });

  it('parses a minimal PartyV1 (required fields only)', () => {
    const party = parsePartyV1({
      partyId: 'party-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      displayName: 'Jane Doe',
      roles: ['viewer'],
    });
    expect(party.partyId).toBe('party-2');
    expect(party.email).toBeUndefined();
    expect(party.phone).toBeUndefined();
    expect(party.externalRefs).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parsePartyV1('nope')).toThrow(PartyParseError);
    expect(() => parsePartyV1(null)).toThrow(PartyParseError);
    expect(() => parsePartyV1([])).toThrow(PartyParseError);
  });

  it('rejects invalid schemaVersion', () => {
    expect(() => parsePartyV1({ ...valid, schemaVersion: 2 })).toThrow(/schemaVersion/);
  });

  it('rejects missing required string fields', () => {
    expect(() => parsePartyV1({ ...valid, displayName: '' })).toThrow(/displayName/);
    expect(() => parsePartyV1({ ...valid, partyId: 123 })).toThrow(/partyId/);
  });

  it('rejects empty roles array', () => {
    expect(() => parsePartyV1({ ...valid, roles: [] })).toThrow(/roles/);
  });

  it('rejects roles with non-string items', () => {
    expect(() => parsePartyV1({ ...valid, roles: [123] })).toThrow(/roles/);
  });
});
