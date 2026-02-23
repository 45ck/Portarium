import { describe, expect, it } from 'vitest';

import { parseAgentConfigV1, parseMachineRegistrationV1 } from './machine-registration-v1.js';

const VALID_MACHINE_REGISTRATION = {
  schemaVersion: 1,
  machineId: 'machine-1',
  workspaceId: 'ws-1',
  endpointUrl: 'https://api.example.com/v1',
  active: true,
  displayName: 'Production Runner',
  capabilities: ['run:workflow', 'run:sync'],
  registeredAtIso: '2026-02-17T00:00:00.000Z',
  executionPolicy: {
    isolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://gateway.example.com'],
    workloadIdentity: 'Required',
  },
  authConfig: { kind: 'bearer', secretRef: 'grants/cg-1' },
};

const VALID_AGENT_CONFIG = {
  schemaVersion: 1,
  agentId: 'agent-1',
  workspaceId: 'ws-1',
  machineId: 'machine-1',
  displayName: 'Classifier Agent',
  capabilities: ['run:workflow'],
  policyTier: 'Auto',
  allowedTools: ['classify', 'read:external'],
  registeredAtIso: '2026-02-18T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// MachineRegistrationV1
// ---------------------------------------------------------------------------

describe('parseMachineRegistrationV1: happy path', () => {
  it('parses a full MachineRegistrationV1', () => {
    const reg = parseMachineRegistrationV1(VALID_MACHINE_REGISTRATION);

    expect(reg.schemaVersion).toBe(1);
    expect(reg.machineId).toBe('machine-1');
    expect(reg.workspaceId).toBe('ws-1');
    expect(reg.endpointUrl).toBe('https://api.example.com/v1');
    expect(reg.active).toBe(true);
    expect(reg.displayName).toBe('Production Runner');
    expect(reg.capabilities).toEqual([{ capability: 'run:workflow' }, { capability: 'run:sync' }]);
    expect(reg.registeredAtIso).toBe('2026-02-17T00:00:00.000Z');
    expect(reg.executionPolicy.isolationMode).toBe('PerTenantWorker');
    expect(reg.authConfig).toEqual({ kind: 'bearer', secretRef: 'grants/cg-1' });
  });

  it('parses with inactive status', () => {
    const reg = parseMachineRegistrationV1({ ...VALID_MACHINE_REGISTRATION, active: false });
    expect(reg.active).toBe(false);
  });

  it('parses with single capability', () => {
    const reg = parseMachineRegistrationV1({
      ...VALID_MACHINE_REGISTRATION,
      capabilities: ['run:workflow'],
    });
    expect(reg.capabilities).toEqual([{ capability: 'run:workflow' }]);
  });

  it('parses authConfig: bearer kind with secretRef', () => {
    const reg = parseMachineRegistrationV1({
      ...VALID_MACHINE_REGISTRATION,
      authConfig: { kind: 'bearer', secretRef: 'grants/cg-1' },
    });
    expect(reg.authConfig).toEqual({ kind: 'bearer', secretRef: 'grants/cg-1' });
  });

  it('parses authConfig: apiKey kind without secretRef', () => {
    const reg = parseMachineRegistrationV1({
      ...VALID_MACHINE_REGISTRATION,
      authConfig: { kind: 'apiKey' },
    });
    expect(reg.authConfig).toEqual({ kind: 'apiKey' });
    expect(reg.authConfig?.secretRef).toBeUndefined();
  });

  it('parses authConfig: none kind', () => {
    const reg = parseMachineRegistrationV1({
      ...VALID_MACHINE_REGISTRATION,
      active: false,
      authConfig: { kind: 'none' },
    });
    expect(reg.authConfig?.kind).toBe('none');
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
    ).toThrow(/capabilities must be an array/i);
  });

  it('rejects invalid capability entries', () => {
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        capabilities: ['invalid'],
      }),
    ).toThrow(/capabilities\[0\].*entity:verb/i);
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        capabilities: [123],
      }),
    ).toThrow(/capabilities\[0\]/i);
  });

  it('rejects duplicate capabilities', () => {
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        capabilities: ['run:workflow', { capability: 'run:workflow' }],
      }),
    ).toThrow(/must not contain duplicate capabilities/i);
  });

  it('rejects invalid registeredAtIso', () => {
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        registeredAtIso: 'not-a-date',
      }),
    ).toThrow(/registeredAtIso/i);
  });

  it('rejects authConfig with invalid kind', () => {
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        authConfig: { kind: 'oauth' },
      }),
    ).toThrow(/authConfig\.kind must be one of/i);
  });

  it('rejects authConfig that is not an object', () => {
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        authConfig: 'bearer',
      }),
    ).toThrow(/authConfig must be an object/i);
  });

  it('rejects missing executionPolicy', () => {
    const invalid = { ...VALID_MACHINE_REGISTRATION } as Record<string, unknown>;
    delete invalid['executionPolicy'];
    expect(() => parseMachineRegistrationV1(invalid)).toThrow(/executionPolicy must be an object/i);
  });

  it('rejects non-https executionPolicy egress entries', () => {
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        executionPolicy: {
          ...VALID_MACHINE_REGISTRATION.executionPolicy,
          egressAllowlist: ['http://gateway.internal'],
        },
      }),
    ).toThrow(/egressAllowlist entries must use https urls/i);
  });

  it('rejects active machine without authConfig', () => {
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        authConfig: undefined,
      }),
    ).toThrow(/active machines require authConfig/i);
  });

  it('rejects active machine with authConfig kind none', () => {
    expect(() =>
      parseMachineRegistrationV1({
        ...VALID_MACHINE_REGISTRATION,
        authConfig: { kind: 'none' },
      }),
    ).toThrow(/active machines require authConfig/i);
  });
});

// ---------------------------------------------------------------------------
// MachineRegistrationV1: backward-compat invariants (bead-0802)
//
// These tests guard rollout safety: new records written with extra fields must
// still be parseable by v1 parsers (forward-compat), and JSONB round-trips that
// produce null for absent optional fields must not break parsing.
// ---------------------------------------------------------------------------

describe('parseMachineRegistrationV1: backward-compat invariants', () => {
  it('tolerates extra unknown fields — v2 records remain parseable by v1 parser (forward-compat)', () => {
    const withFutureFields = {
      ...VALID_MACHINE_REGISTRATION,
      // Fields earmarked for v2 in ADR-0098 §4 — must be silently ignored now
      healthCheckUrl: 'https://health.example.com',
      labels: { env: 'prod', region: 'us-east-1' },
    };
    const reg = parseMachineRegistrationV1(withFutureFields);
    expect(reg.schemaVersion).toBe(1);
    expect(reg.machineId).toBe('machine-1');
    // Extra fields must not appear on the typed output
    expect((reg as Record<string, unknown>)['healthCheckUrl']).toBeUndefined();
    expect((reg as Record<string, unknown>)['labels']).toBeUndefined();
  });

  it('treats authConfig: null as absent — JSONB null-to-undefined round-trip safety', () => {
    // PostgreSQL JSONB may serialize a missing optional field as null when
    // records are read by tooling or migration scripts. Parsers must not throw.
    const withNullAuth = {
      ...VALID_MACHINE_REGISTRATION,
      active: false,
      authConfig: null,
    };
    const reg = parseMachineRegistrationV1(withNullAuth);
    expect(reg.authConfig).toBeUndefined();
    expect(reg.active).toBe(false);
  });

  it('inactive machine with no authConfig key round-trips correctly', () => {
    const { authConfig: _unused, ...noAuth } = {
      ...VALID_MACHINE_REGISTRATION,
      active: false,
    };
    const reg = parseMachineRegistrationV1(noAuth);
    expect(reg.active).toBe(false);
    expect(reg.authConfig).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AgentConfigV1
// ---------------------------------------------------------------------------

describe('parseAgentConfigV1: happy path', () => {
  it('parses a full AgentConfigV1', () => {
    const agent = parseAgentConfigV1(VALID_AGENT_CONFIG);

    expect(agent.schemaVersion).toBe(1);
    expect(agent.agentId).toBe('agent-1');
    expect(agent.workspaceId).toBe('ws-1');
    expect(agent.machineId).toBe('machine-1');
    expect(agent.displayName).toBe('Classifier Agent');
    expect(agent.capabilities).toEqual([{ capability: 'run:workflow' }]);
    expect(agent.policyTier).toBe('Auto');
    expect(agent.allowedTools).toEqual(['classify', 'read:external']);
    expect(agent.registeredAtIso).toBe('2026-02-18T00:00:00.000Z');
  });

  it('parses all valid policy tiers', () => {
    for (const tier of ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const) {
      const agent = parseAgentConfigV1({ ...VALID_AGENT_CONFIG, policyTier: tier });
      expect(agent.policyTier).toBe(tier);
    }
  });

  it('parses agent with empty allowedTools', () => {
    const agent = parseAgentConfigV1({ ...VALID_AGENT_CONFIG, allowedTools: [] });
    expect(agent.allowedTools).toEqual([]);
  });
});

describe('parseAgentConfigV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parseAgentConfigV1(null)).toThrow(/AgentConfig must be an object/i);
    expect(() => parseAgentConfigV1('bad')).toThrow(/AgentConfig must be an object/i);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() => parseAgentConfigV1({ ...VALID_AGENT_CONFIG, schemaVersion: 2 })).toThrow(
      /schemaVersion/i,
    );
  });

  it('rejects missing required fields', () => {
    expect(() => parseAgentConfigV1({ ...VALID_AGENT_CONFIG, agentId: undefined })).toThrow(
      /agentId/i,
    );
    expect(() => parseAgentConfigV1({ ...VALID_AGENT_CONFIG, machineId: undefined })).toThrow(
      /machineId/i,
    );
    expect(() => parseAgentConfigV1({ ...VALID_AGENT_CONFIG, displayName: undefined })).toThrow(
      /displayName/i,
    );
    expect(() => parseAgentConfigV1({ ...VALID_AGENT_CONFIG, capabilities: undefined })).toThrow(
      /capabilities/i,
    );
  });

  it('rejects invalid policyTier', () => {
    expect(() => parseAgentConfigV1({ ...VALID_AGENT_CONFIG, policyTier: 'Automatic' })).toThrow(
      /policyTier must be one of/i,
    );
  });

  it('rejects non-array allowedTools', () => {
    expect(() => parseAgentConfigV1({ ...VALID_AGENT_CONFIG, allowedTools: 'classify' })).toThrow(
      /allowedTools must be an array/i,
    );
  });

  it('rejects allowedTools entries that are blank', () => {
    expect(() =>
      parseAgentConfigV1({ ...VALID_AGENT_CONFIG, allowedTools: ['valid', ''] }),
    ).toThrow(/allowedTools\[1\]/i);
  });

  it('rejects duplicate capability declarations', () => {
    expect(() =>
      parseAgentConfigV1({
        ...VALID_AGENT_CONFIG,
        capabilities: ['run:workflow', { capability: 'run:workflow' }],
      }),
    ).toThrow(/must not contain duplicate capabilities/i);
  });

  it('rejects tools above policy tier blast radius', () => {
    expect(() =>
      parseAgentConfigV1({
        ...VALID_AGENT_CONFIG,
        policyTier: 'Auto',
        allowedTools: ['shell.exec'],
      }),
    ).toThrow(/allowedTools violate policyTier Auto/i);
  });

  it('rejects invalid registeredAtIso', () => {
    expect(() =>
      parseAgentConfigV1({ ...VALID_AGENT_CONFIG, registeredAtIso: 'bad-date' }),
    ).toThrow(/registeredAtIso/i);
  });
});

// ---------------------------------------------------------------------------
// AgentConfigV1: backward-compat invariants (bead-0802)
// ---------------------------------------------------------------------------

describe('parseAgentConfigV1: backward-compat invariants', () => {
  it('tolerates extra unknown fields — v2 records remain parseable by v1 parser (forward-compat)', () => {
    const withFutureFields = {
      ...VALID_AGENT_CONFIG,
      // Fields earmarked for v2 in ADR-0098 §4 — must be silently ignored now
      description: 'Future optional description field',
      updatedAtIso: '2026-02-23T00:00:00.000Z',
    };
    const agent = parseAgentConfigV1(withFutureFields);
    expect(agent.schemaVersion).toBe(1);
    expect(agent.agentId).toBe('agent-1');
    // Extra fields must not appear on the typed output
    expect((agent as Record<string, unknown>)['description']).toBeUndefined();
    expect((agent as Record<string, unknown>)['updatedAtIso']).toBeUndefined();
  });
});
