import { describe, expect, it } from 'vitest';

import { parseMachineRegistrationV1 } from './machine-registration-v1.js';

const VALID_MACHINE_REGISTRATION = {
  schemaVersion: 1,
  machineId: 'machine-1',
  workspaceId: 'ws-1',
  endpointUrl: 'https://api.example.com/v1',
  active: true,
  displayName: 'Production Runner',
  capabilities: ['run:workflow', 'run:sync'],
  registeredAtIso: '2026-02-17T00:00:00.000Z',
};

describe('parseMachineRegistrationV1: happy path', () => {
  it('parses a full MachineRegistrationV1', () => {
    const reg = parseMachineRegistrationV1(VALID_MACHINE_REGISTRATION);

    expect(reg.schemaVersion).toBe(1);
    expect(reg.machineId).toBe('machine-1');
    expect(reg.workspaceId).toBe('ws-1');
    expect(reg.endpointUrl).toBe('https://api.example.com/v1');
    expect(reg.active).toBe(true);
    expect(reg.displayName).toBe('Production Runner');
    expect(reg.capabilities).toEqual(['run:workflow', 'run:sync']);
    expect(reg.registeredAtIso).toBe('2026-02-17T00:00:00.000Z');
  });

  it('parses with inactive status', () => {
    const reg = parseMachineRegistrationV1({
      ...VALID_MACHINE_REGISTRATION,
      active: false,
    });

    expect(reg.active).toBe(false);
  });

  it('parses with single capability', () => {
    const reg = parseMachineRegistrationV1({
      ...VALID_MACHINE_REGISTRATION,
      capabilities: ['run:workflow'],
    });

    expect(reg.capabilities).toEqual(['run:workflow']);
  });
});

describe('parseMachineRegistrationV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parseMachineRegistrationV1('nope')).toThrow(
      /MachineRegistration must be an object/i,
    );
    expect(() => parseMachineRegistrationV1(null)).toThrow(
      /MachineRegistration must be an object/i,
    );
    expect(() => parseMachineRegistrationV1([])).toThrow(/MachineRegistration must be an object/i);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, schemaVersion: 2 }),
    ).toThrow(/schemaVersion/i);
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, schemaVersion: 1.5 }),
    ).toThrow(/schemaVersion/i);
  });

  it('rejects missing required string fields', () => {
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, machineId: undefined }),
    ).toThrow(/machineId/i);
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, workspaceId: undefined }),
    ).toThrow(/workspaceId/i);
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, endpointUrl: undefined }),
    ).toThrow(/endpointUrl/i);
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, displayName: undefined }),
    ).toThrow(/displayName/i);
  });

  it('rejects blank string fields', () => {
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, machineId: '   ' }),
    ).toThrow(/machineId/i);
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, endpointUrl: '' }),
    ).toThrow(/endpointUrl/i);
  });

  it('rejects non-boolean active', () => {
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, active: 'yes' }),
    ).toThrow(/active must be a boolean/i);
  });

  it('rejects empty capabilities array', () => {
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, capabilities: [] }),
    ).toThrow(/capabilities must be a non-empty array/i);
  });

  it('rejects non-array capabilities', () => {
    expect(() =>
      parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, capabilities: 'bad' }),
    ).toThrow(/capabilities must be a non-empty array/i);
  });

  it('rejects invalid capability entries', () => {
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        capabilities: ['valid', ''],
      }),
    ).toThrow(/capabilities\[1\]/i);
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        capabilities: [123],
      }),
    ).toThrow(/capabilities\[0\]/i);
  });

  it('rejects invalid registeredAtIso', () => {
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        registeredAtIso: 'not-a-date',
      }),
    ).toThrow(/registeredAtIso/i);
  });
});
