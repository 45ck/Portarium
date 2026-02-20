import { describe, expect, it } from 'vitest';

import { CapabilityKey } from '../primitives/index.js';
import {
  establishCapabilityHandshakeV1,
  parseCapabilityDescriptorV1,
  parseCapabilityDescriptorsV1,
  routeCapabilityToAgentV1,
  type CapabilityDescriptorV1,
} from './capability-handshake-v1.js';

class TestParseError extends Error {}

const capability = (value: string): CapabilityDescriptorV1 => ({
  capability: CapabilityKey(value),
});

describe('parseCapabilityDescriptorV1', () => {
  it('parses a descriptor object', () => {
    const parsed = parseCapabilityDescriptorV1({ capability: 'run:workflow' });
    expect(parsed).toEqual({ capability: 'run:workflow' });
  });

  it('parses a raw capability string', () => {
    const parsed = parseCapabilityDescriptorV1('run:sync');
    expect(parsed).toEqual({ capability: 'run:sync' });
  });

  it('rejects non entity:verb capability formats', () => {
    expect(() => parseCapabilityDescriptorV1({ capability: 'runWorkflow' })).toThrow(
      /must match "entity:verb" format/i,
    );
  });
});

describe('parseCapabilityDescriptorsV1', () => {
  it('parses a mixed list of string and object entries', () => {
    const parsed = parseCapabilityDescriptorsV1(
      ['run:workflow', { capability: 'run:sync' }],
      'capabilities',
      TestParseError,
      { minLength: 1 },
    );
    expect(parsed).toEqual([{ capability: 'run:workflow' }, { capability: 'run:sync' }]);
  });

  it('rejects duplicate capability declarations', () => {
    expect(() =>
      parseCapabilityDescriptorsV1(
        ['run:workflow', { capability: 'run:workflow' }],
        'capabilities',
        TestParseError,
      ),
    ).toThrow(/must not contain duplicate capabilities/i);
  });
});

describe('establishCapabilityHandshakeV1', () => {
  it('returns routable and non-routable capability partitions for agent declarations', () => {
    const handshake = establishCapabilityHandshakeV1({
      machineCapabilities: [capability('run:workflow'), capability('run:sync')],
      agentCapabilities: [capability('run:workflow'), capability('run:deploy')],
    });

    expect(handshake.routableCapabilities).toEqual([{ capability: 'run:workflow' }]);
    expect(handshake.nonRoutableAgentCapabilities).toEqual([{ capability: 'run:deploy' }]);
  });
});

describe('routeCapabilityToAgentV1', () => {
  const handshake = establishCapabilityHandshakeV1({
    machineCapabilities: [capability('run:workflow')],
    agentCapabilities: [capability('run:workflow')],
  });

  it('routes when both machine and agent declared the capability', () => {
    const decision = routeCapabilityToAgentV1({
      handshake,
      capability: capability('run:workflow'),
    });
    expect(decision).toEqual({
      decision: 'Route',
      capability: { capability: 'run:workflow' },
    });
  });

  it('denies when capability is not declared by the agent', () => {
    const decision = routeCapabilityToAgentV1({
      handshake,
      capability: capability('run:sync'),
    });
    expect(decision).toEqual({
      decision: 'Deny',
      reason: 'CapabilityNotDeclaredByAgent',
      capability: { capability: 'run:sync' },
    });
  });

  it('denies when capability is declared by agent but unavailable on machine', () => {
    const driftedHandshake = establishCapabilityHandshakeV1({
      machineCapabilities: [capability('run:workflow')],
      agentCapabilities: [capability('run:workflow'), capability('run:sync')],
    });

    const decision = routeCapabilityToAgentV1({
      handshake: driftedHandshake,
      capability: capability('run:sync'),
    });

    expect(decision).toEqual({
      decision: 'Deny',
      reason: 'CapabilityNotSupportedByMachine',
      capability: { capability: 'run:sync' },
    });
  });
});
