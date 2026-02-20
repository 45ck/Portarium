import { describe, expect, it } from 'vitest';

import { CapabilityKey } from '../primitives/index.js';
import {
  evaluateCapabilityDriftQuarantinePolicyV1,
  summarizeCapabilityDriftV1,
  type CapabilityDriftDeltaV1,
} from './capability-drift-quarantine-policy-v1.js';
import type { CapabilityDescriptorV1 } from './capability-handshake-v1.js';

const capability = (value: string): CapabilityDescriptorV1 => ({
  capability: CapabilityKey(value),
});

describe('evaluateCapabilityDriftQuarantinePolicyV1', () => {
  it('allows when there is no capability drift', () => {
    const result = evaluateCapabilityDriftQuarantinePolicyV1({
      baselineCapabilities: [capability('run:workflow')],
      observedCapabilities: [capability('run:workflow')],
      source: 'Heartbeat',
      reviewed: false,
    });

    expect(result).toEqual({
      decision: 'Allow',
      reason: 'NoDrift',
      source: 'Heartbeat',
      sideEffects: 'Allowed',
      drift: {
        addedCapabilities: [],
        removedCapabilities: [],
      },
    });
  });

  it('quarantines when added capabilities are detected without review', () => {
    const result = evaluateCapabilityDriftQuarantinePolicyV1({
      baselineCapabilities: [capability('run:workflow')],
      observedCapabilities: [capability('run:workflow'), capability('run:sync')],
      source: 'ReRegistration',
      reviewed: false,
    });

    expect(result).toEqual({
      decision: 'Quarantine',
      reason: 'CapabilityDriftDetected',
      source: 'ReRegistration',
      sideEffects: 'Denied',
      runState: 'PolicyBlocked',
      drift: {
        addedCapabilities: [{ capability: 'run:sync' }],
        removedCapabilities: [],
      },
    });
  });

  it('quarantines when removed capabilities are detected without review', () => {
    const result = evaluateCapabilityDriftQuarantinePolicyV1({
      baselineCapabilities: [capability('run:workflow'), capability('run:sync')],
      observedCapabilities: [capability('run:workflow')],
      source: 'Heartbeat',
      reviewed: false,
    });

    expect(result).toEqual({
      decision: 'Quarantine',
      reason: 'CapabilityDriftDetected',
      source: 'Heartbeat',
      sideEffects: 'Denied',
      runState: 'PolicyBlocked',
      drift: {
        addedCapabilities: [],
        removedCapabilities: [{ capability: 'run:sync' }],
      },
    });
  });

  it('allows drift when explicitly reviewed', () => {
    const result = evaluateCapabilityDriftQuarantinePolicyV1({
      baselineCapabilities: [capability('run:workflow')],
      observedCapabilities: [capability('run:workflow'), capability('run:sync')],
      source: 'ReRegistration',
      reviewed: true,
    });

    expect(result).toEqual({
      decision: 'Allow',
      reason: 'DriftReviewed',
      source: 'ReRegistration',
      sideEffects: 'Allowed',
      drift: {
        addedCapabilities: [{ capability: 'run:sync' }],
        removedCapabilities: [],
      },
    });
  });
});

describe('summarizeCapabilityDriftV1', () => {
  it('summarizes added and removed capability sets', () => {
    const drift: CapabilityDriftDeltaV1 = {
      addedCapabilities: [capability('run:sync')],
      removedCapabilities: [capability('run:workflow')],
    };
    expect(summarizeCapabilityDriftV1(drift)).toBe('added: run:sync | removed: run:workflow');
  });

  it('returns no drift when sets are empty', () => {
    expect(
      summarizeCapabilityDriftV1({
        addedCapabilities: [],
        removedCapabilities: [],
      }),
    ).toBe('no drift');
  });
});
