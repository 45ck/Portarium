import { describe, expect, it } from 'vitest';

import { parseAgentConfigV1, parseMachineRegistrationV1 } from './machine-registration-v1.js';
import { validateOpenClawAgentBindingV1 } from './openclaw-agent-binding-v1.js';

const VALID_MACHINE = parseMachineRegistrationV1({
  schemaVersion: 1,
  machineId: 'machine-1',
  workspaceId: 'ws-1',
  endpointUrl: 'https://openclaw.example.com/v1',
  active: true,
  displayName: 'OpenClaw Runner',
  capabilities: ['run:workflow', 'run:sync', 'read:external'],
  registeredAtIso: '2026-01-01T00:00:00.000Z',
  executionPolicy: {
    isolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://gateway.example.com'],
    workloadIdentity: 'Required',
  },
  authConfig: { kind: 'bearer', secretRef: 'grants/cg-1' },
});

const VALID_AGENT = parseAgentConfigV1({
  schemaVersion: 1,
  agentId: 'agent-1',
  workspaceId: 'ws-1',
  machineId: 'machine-1',
  displayName: 'Classifier Agent',
  capabilities: ['run:workflow'],
  policyTier: 'Auto',
  allowedTools: ['read:external'],
  registeredAtIso: '2026-01-01T00:00:00.000Z',
});

describe('validateOpenClawAgentBindingV1', () => {
  it('returns valid for a compatible agent-machine pair', () => {
    const result = validateOpenClawAgentBindingV1(VALID_AGENT, VALID_MACHINE);

    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');

    expect(result.agentId).toBe('agent-1');
    expect(result.machineId).toBe('machine-1');
    expect(result.handshake.routableCapabilities).toHaveLength(1);
    expect(String(result.handshake.routableCapabilities[0]!.capability)).toBe('run:workflow');
    expect(result.handshake.nonRoutableAgentCapabilities).toHaveLength(0);
  });

  it('includes partial capability coverage in the handshake when valid', () => {
    const agentWithExtra = parseAgentConfigV1({
      schemaVersion: 1,
      agentId: 'agent-2',
      workspaceId: 'ws-1',
      machineId: 'machine-1',
      displayName: 'Multi-Cap Agent',
      capabilities: ['run:workflow', 'run:sync'],
      policyTier: 'Auto',
      allowedTools: ['read:external'],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
    });

    const result = validateOpenClawAgentBindingV1(agentWithExtra, VALID_MACHINE);

    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.handshake.routableCapabilities).toHaveLength(2);
    expect(result.handshake.nonRoutableAgentCapabilities).toHaveLength(0);
  });

  it('is valid when agent has some non-routable capabilities (partial coverage)', () => {
    const agentPartial = parseAgentConfigV1({
      schemaVersion: 1,
      agentId: 'agent-partial',
      workspaceId: 'ws-1',
      machineId: 'machine-1',
      displayName: 'Partial Agent',
      capabilities: ['run:workflow', 'run:heavy'],
      policyTier: 'Auto',
      allowedTools: ['read:external'],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
    });

    const result = validateOpenClawAgentBindingV1(agentPartial, VALID_MACHINE);

    // Partial coverage is valid — at least one capability is routable
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.handshake.routableCapabilities).toHaveLength(1);
    expect(result.handshake.nonRoutableAgentCapabilities).toHaveLength(1);
    expect(String(result.handshake.nonRoutableAgentCapabilities[0]!.capability)).toBe('run:heavy');
  });

  it('returns invalid with MachineIdMismatch when machineIds differ', () => {
    const wrongMachineAgent = parseAgentConfigV1({
      schemaVersion: 1,
      agentId: 'agent-wrong',
      workspaceId: 'ws-1',
      machineId: 'machine-99',
      displayName: 'Wrong Machine Agent',
      capabilities: ['run:workflow'],
      policyTier: 'Auto',
      allowedTools: ['read:external'],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
    });

    const result = validateOpenClawAgentBindingV1(wrongMachineAgent, VALID_MACHINE);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.kind).toBe('MachineIdMismatch');
    expect(result.violations[0]!.detail).toContain('machine-99');
  });

  it('returns invalid with MachineInactive when machine is inactive', () => {
    const inactiveMachine = parseMachineRegistrationV1({
      schemaVersion: 1,
      machineId: 'machine-1',
      workspaceId: 'ws-1',
      endpointUrl: 'https://openclaw.example.com/v1',
      active: false,
      displayName: 'Inactive Runner',
      capabilities: ['run:workflow'],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
      executionPolicy: {
        isolationMode: 'PerTenantWorker',
        egressAllowlist: ['https://gateway.example.com'],
        workloadIdentity: 'Required',
      },
    });

    const result = validateOpenClawAgentBindingV1(VALID_AGENT, inactiveMachine);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.violations.some((v) => v.kind === 'MachineInactive')).toBe(true);
  });

  it('returns invalid with NoCapabilityIntersection when no capabilities match', () => {
    const disjointAgent = parseAgentConfigV1({
      schemaVersion: 1,
      agentId: 'agent-disjoint',
      workspaceId: 'ws-1',
      machineId: 'machine-1',
      displayName: 'Disjoint Agent',
      capabilities: ['run:robotics'],
      policyTier: 'Auto',
      allowedTools: ['read:external'],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
    });

    const result = validateOpenClawAgentBindingV1(disjointAgent, VALID_MACHINE);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.violations.some((v) => v.kind === 'NoCapabilityIntersection')).toBe(true);
  });

  it('collects multiple violations independently', () => {
    const wrongMachine = parseMachineRegistrationV1({
      schemaVersion: 1,
      machineId: 'machine-2',
      workspaceId: 'ws-1',
      endpointUrl: 'https://openclaw2.example.com/v1',
      active: false,
      displayName: 'Wrong Inactive Runner',
      capabilities: ['run:robotics'],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
      executionPolicy: {
        isolationMode: 'PerTenantWorker',
        egressAllowlist: ['https://gateway.example.com'],
        workloadIdentity: 'Required',
      },
    });

    const result = validateOpenClawAgentBindingV1(VALID_AGENT, wrongMachine);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    // Should have MachineIdMismatch + MachineInactive + NoCapabilityIntersection
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
    const kinds = result.violations.map((v) => v.kind);
    expect(kinds).toContain('MachineInactive');
    expect(kinds).toContain('NoCapabilityIntersection');
  });

  it('result includes agentId and machineId on both valid and invalid paths', () => {
    const valid = validateOpenClawAgentBindingV1(VALID_AGENT, VALID_MACHINE);
    expect(valid.agentId).toBe('agent-1');
    expect(valid.machineId).toBe('machine-1');

    const inactiveMachine = parseMachineRegistrationV1({
      schemaVersion: 1,
      machineId: 'machine-1',
      workspaceId: 'ws-1',
      endpointUrl: 'https://openclaw.example.com/v1',
      active: false,
      displayName: 'Inactive',
      capabilities: ['run:workflow'],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
      executionPolicy: {
        isolationMode: 'PerTenantWorker',
        egressAllowlist: ['https://gateway.example.com'],
        workloadIdentity: 'Required',
      },
    });

    const invalid = validateOpenClawAgentBindingV1(VALID_AGENT, inactiveMachine);
    expect(invalid.agentId).toBe('agent-1');
    expect(invalid.machineId).toBe('machine-1');
  });
});
