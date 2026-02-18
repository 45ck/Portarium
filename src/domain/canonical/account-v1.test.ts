import { describe, expect, it } from 'vitest';

import { AccountParseError, parseAccountV1 } from './account-v1.js';

describe('parseAccountV1', () => {
  const valid = {
    accountId: 'acct-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    accountName: 'Cash',
    accountCode: '1000',
    accountType: 'asset',
    currencyCode: 'USD',
    isActive: true,
    externalRefs: [
      {
        sorName: 'quickbooks',
        portFamily: 'FinanceAccounting',
        externalId: 'qb-acct-1',
        externalType: 'Account',
      },
    ],
  };

  it('parses a full AccountV1 with all fields', () => {
    const account = parseAccountV1(valid);
    expect(account.accountId).toBe('acct-1');
    expect(account.accountName).toBe('Cash');
    expect(account.accountCode).toBe('1000');
    expect(account.accountType).toBe('asset');
    expect(account.currencyCode).toBe('USD');
    expect(account.isActive).toBe(true);
    expect(account.externalRefs).toHaveLength(1);
  });

  it('parses a minimal AccountV1 (required fields only)', () => {
    const account = parseAccountV1({
      accountId: 'acct-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      accountName: 'Revenue',
      accountCode: '4000',
      accountType: 'revenue',
      currencyCode: 'EUR',
      isActive: false,
    });
    expect(account.accountId).toBe('acct-2');
    expect(account.externalRefs).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseAccountV1('nope')).toThrow(AccountParseError);
    expect(() => parseAccountV1(null)).toThrow(AccountParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseAccountV1({ ...valid, accountName: '' })).toThrow(/accountName/);
    expect(() => parseAccountV1({ ...valid, accountCode: 123 })).toThrow(/accountCode/);
  });

  it('rejects invalid accountType', () => {
    expect(() => parseAccountV1({ ...valid, accountType: 'debit' })).toThrow(/accountType/);
  });

  it('rejects invalid currencyCode', () => {
    expect(() => parseAccountV1({ ...valid, currencyCode: 'us' })).toThrow(/currencyCode/);
  });

  it('rejects non-boolean isActive', () => {
    expect(() => parseAccountV1({ ...valid, isActive: 'yes' })).toThrow(/isActive/);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() => parseAccountV1({ ...valid, schemaVersion: 2 })).toThrow(/schemaVersion must be 1/);
  });

  it('rejects non-array externalRefs', () => {
    expect(() => parseAccountV1({ ...valid, externalRefs: 'bad' })).toThrow(AccountParseError);
  });
});
