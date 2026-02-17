import { describe, expect, it } from 'vitest';

import { PORT_FAMILY_CAPABILITIES } from './port-family-capabilities-v1.js';
import { parsePortV1 } from './port-v1.js';

const canonicalDate = '2026-02-16T00:00:00.000Z';

function basePort(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    portId: 'port-1',
    workspaceId: 'ws-1',
    adapterId: 'adapter-1',
    name: 'Port adapter',
    status: 'Active',
    createdAtIso: canonicalDate,
    ...overrides,
  };
}

describe('parsePortV1: happy path', () => {
  it('parses a minimal active port', () => {
    const port = parsePortV1({
      ...basePort({
        portFamily: 'CrmSales',
        supportedOperations: ['party:read', 'opportunity:write'],
      }),
    });

    expect(port.status).toBe('Active');
    expect(port.supportedOperations).toEqual(['party:read', 'opportunity:write']);
    expect(port.endpoint).toBeUndefined();
  });

  it('supports documented capability matrix entries per family', () => {
    const portFamilies = Object.keys(
      PORT_FAMILY_CAPABILITIES,
    ) as (keyof typeof PORT_FAMILY_CAPABILITIES)[];

    for (const portFamily of portFamilies) {
      const capabilities = PORT_FAMILY_CAPABILITIES[portFamily];
      const port = parsePortV1({
        ...basePort({
          portFamily,
          supportedOperations: [capabilities[0]],
        }),
      });

      expect(port.portFamily).toBe(portFamily);
      expect(port.supportedOperations).toEqual([capabilities[0]]);
    }
  });

  it('parses auth metadata and updated timestamp', () => {
    const port = parsePortV1({
      ...basePort({
        portId: 'port-2',
        adapterId: 'adapter-2',
        portFamily: 'PaymentsBilling',
        supportedOperations: ['charge:write'],
        endpoint: 'https://stripe.example.com',
        auth: {
          mode: 'oauth2',
          scopes: ['payments:read', 'payments:write'],
        },
        updatedAtIso: '2026-02-16T00:02:00.000Z',
      }),
    });

    expect(port.auth?.mode).toBe('oauth2');
    expect(port.auth?.scopes).toEqual(['payments:read', 'payments:write']);
    expect(port.updatedAtIso).toBe('2026-02-16T00:02:00.000Z');
  });
});

describe('parsePortV1: validation', () => {
  it('rejects non-objects and unsupported schema versions', () => {
    expect(() => parsePortV1('nope')).toThrow(/Port must be an object/i);
    expect(() =>
      parsePortV1({
        ...basePort({
          portFamily: 'CrmSales',
          schemaVersion: 2,
          supportedOperations: ['party:read'],
        }),
      }),
    ).toThrow(/schemaVersion/i);
  });

  it('rejects unsupported values and invalid shapes', () => {
    expect(() =>
      parsePortV1({
        ...basePort({
          portFamily: 'UnknownFamily' as string,
          supportedOperations: ['party:read'],
        }),
      }),
    ).toThrow(/portFamily/i);

    expect(() =>
      parsePortV1({
        ...basePort({
          portFamily: 'CrmSales',
          supportedOperations: ['party:read', ''],
        }),
      }),
    ).toThrow(/supportedOperations\[1\]/);

    expect(() =>
      parsePortV1({
        ...basePort({
          portFamily: 'CrmSales',
          supportedOperations: ['party:read', 'party:read'],
        }),
      }),
    ).toThrow(/supportedOperations must not contain duplicates/i);

    expect(() =>
      parsePortV1({
        ...basePort({
          portFamily: 'CrmSales',
          supportedOperations: ['account:read'],
        }),
      }),
    ).toThrow(/not supported for port family|supported values are/);
  });

  it('rejects malformed capability format', () => {
    expect(() =>
      parsePortV1({
        ...basePort({
          portFamily: 'CrmSales',
          supportedOperations: ['party-read'],
        }),
      }),
    ).toThrow(/must be in <noun>:<action> format/);
  });

  it('rejects bad auth metadata', () => {
    expect(() =>
      parsePortV1({
        ...basePort({
          portFamily: 'CrmSales',
          supportedOperations: ['party:read'],
          auth: {
            mode: 'bad-mode',
            scopes: ['party:read'],
          },
        }),
      }),
    ).toThrow(/auth.mode/);

    expect(() =>
      parsePortV1({
        ...basePort({
          portFamily: 'CrmSales',
          supportedOperations: ['party:read'],
          auth: {
            mode: 'oauth2',
            scopes: [''],
          },
        }),
      }),
    ).toThrow(/auth.scopes\[0\]/);
  });
});
