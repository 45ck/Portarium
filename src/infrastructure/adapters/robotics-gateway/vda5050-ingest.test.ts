/**
 * Unit tests for VDA 5050 ingest adapter.
 *
 * Validates message parsing, topic parsing, and domain mapping for
 * VDA 5050 v2.0 state and connection messages.
 *
 * Bead: bead-0567
 */

import { describe, expect, it } from 'vitest';
import {
  parseVda5050StateMessage,
  parseVda5050ConnectionMessage,
  parseVda5050Topic,
  mapVda5050ConnectionState,
  mapVda5050ActionStatus,
  vda5050RobotId,
  vda5050FleetId,
  Vda5050ParseError,
} from './vda5050-ingest.js';

// ── State message parsing ─────────────────────────────────────────────────────

const MINIMAL_STATE = {
  headerId: 1,
  timestamp: '2026-02-22T14:00:00.000Z',
  version: '2.0.0',
  manufacturer: 'KUKA',
  serialNumber: 'AGV-001',
  driving: false,
  operatingMode: 'AUTOMATIC',
  batteryState: { batteryCharge: 87.5, charging: false },
  errors: [],
  safetyState: { eStopActivated: false, fieldViolation: false },
};

describe('parseVda5050StateMessage', () => {
  it('parses a minimal valid state message', () => {
    const result = parseVda5050StateMessage(MINIMAL_STATE);
    expect(result.manufacturer).toBe('KUKA');
    expect(result.serialNumber).toBe('AGV-001');
    expect(result.driving).toBe(false);
    expect(result.batteryState.batteryCharge).toBe(87.5);
    expect(result.safetyState.eStopActivated).toBe(false);
  });

  it('parses a state message with action states', () => {
    const msg = {
      ...MINIMAL_STATE,
      driving: true,
      orderId: 'order-123',
      actionStates: [
        { actionId: 'act-1', actionType: 'move', actionStatus: 'RUNNING' },
        { actionId: 'act-2', actionType: 'lift', actionStatus: 'WAITING' },
      ],
    };
    const result = parseVda5050StateMessage(msg);
    expect(result.actionStates).toHaveLength(2);
    expect(result.actionStates![0]!.actionStatus).toBe('RUNNING');
  });

  it('parses a state message with errors', () => {
    const msg = {
      ...MINIMAL_STATE,
      errors: [
        { errorType: 'SENSOR_FAILURE', errorLevel: 'WARNING', errorDescription: 'Lidar degraded' },
      ],
    };
    const result = parseVda5050StateMessage(msg);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.errorLevel).toBe('WARNING');
  });

  it('throws Vda5050ParseError when manufacturer is missing', () => {
    const { manufacturer: _, ...noMfr } = MINIMAL_STATE;
    expect(() => parseVda5050StateMessage(noMfr)).toThrow(Vda5050ParseError);
  });

  it('throws Vda5050ParseError when serialNumber is missing', () => {
    const { serialNumber: _, ...noSerial } = MINIMAL_STATE;
    expect(() => parseVda5050StateMessage(noSerial)).toThrow(Vda5050ParseError);
  });

  it('throws Vda5050ParseError when driving is not boolean', () => {
    const msg = { ...MINIMAL_STATE, driving: 'yes' };
    expect(() => parseVda5050StateMessage(msg)).toThrow(Vda5050ParseError);
  });

  it('throws Vda5050ParseError when batteryState.batteryCharge is missing', () => {
    const msg = { ...MINIMAL_STATE, batteryState: { charging: false } };
    expect(() => parseVda5050StateMessage(msg)).toThrow(Vda5050ParseError);
  });

  it('throws Vda5050ParseError when safetyState.eStopActivated is missing', () => {
    const msg = { ...MINIMAL_STATE, safetyState: { fieldViolation: false } };
    expect(() => parseVda5050StateMessage(msg)).toThrow(Vda5050ParseError);
  });

  it('throws Vda5050ParseError for non-object payload', () => {
    expect(() => parseVda5050StateMessage('not-an-object')).toThrow(Vda5050ParseError);
    expect(() => parseVda5050StateMessage(null)).toThrow(Vda5050ParseError);
    expect(() => parseVda5050StateMessage([1, 2])).toThrow(Vda5050ParseError);
  });
});

// ── Connection message parsing ────────────────────────────────────────────────

describe('parseVda5050ConnectionMessage', () => {
  it('parses an ONLINE connection message', () => {
    const msg = {
      headerId: 1, timestamp: '2026-02-22T14:00:00.000Z', version: '2.0.0',
      manufacturer: 'KUKA', serialNumber: 'AGV-001', connectionState: 'ONLINE',
    };
    const result = parseVda5050ConnectionMessage(msg);
    expect(result.connectionState).toBe('ONLINE');
    expect(result.manufacturer).toBe('KUKA');
  });

  it('parses OFFLINE and CONNECTIONBROKEN states', () => {
    const base = {
      headerId: 1, timestamp: '2026-02-22T14:00:00.000Z', version: '2.0.0',
      manufacturer: 'M', serialNumber: 'S',
    };
    expect(parseVda5050ConnectionMessage({ ...base, connectionState: 'OFFLINE' }).connectionState).toBe('OFFLINE');
    expect(parseVda5050ConnectionMessage({ ...base, connectionState: 'CONNECTIONBROKEN' }).connectionState).toBe('CONNECTIONBROKEN');
  });

  it('throws Vda5050ParseError for invalid connectionState', () => {
    const msg = {
      headerId: 1, timestamp: '', version: '2.0.0',
      manufacturer: 'KUKA', serialNumber: 'S', connectionState: 'UNKNOWN_STATE',
    };
    expect(() => parseVda5050ConnectionMessage(msg)).toThrow(Vda5050ParseError);
  });
});

// ── Topic parsing ─────────────────────────────────────────────────────────────

describe('parseVda5050Topic', () => {
  it('parses a standard VDA 5050 topic', () => {
    const parts = parseVda5050Topic('uagv/v2/KUKA/AGV-001/state');
    expect(parts.interfaceName).toBe('uagv');
    expect(parts.vdaVersion).toBe('v2');
    expect(parts.manufacturer).toBe('KUKA');
    expect(parts.serialNumber).toBe('AGV-001');
    expect(parts.subtopic).toBe('state');
  });

  it('parses multi-segment subtopics', () => {
    const parts = parseVda5050Topic('uagv/v2/Vendor/Robot-42/visualization/position');
    expect(parts.subtopic).toBe('visualization/position');
    expect(parts.serialNumber).toBe('Robot-42');
  });

  it('throws Vda5050ParseError for too-short topic', () => {
    expect(() => parseVda5050Topic('uagv/v2/KUKA')).toThrow(Vda5050ParseError);
    expect(() => parseVda5050Topic('')).toThrow(Vda5050ParseError);
  });
});

// ── Domain state mapping ──────────────────────────────────────────────────────

describe('mapVda5050ConnectionState', () => {
  it('maps ONLINE → Online', () => {
    expect(mapVda5050ConnectionState('ONLINE')).toBe('Online');
  });
  it('maps OFFLINE → Offline', () => {
    expect(mapVda5050ConnectionState('OFFLINE')).toBe('Offline');
  });
  it('maps CONNECTIONBROKEN → Degraded', () => {
    expect(mapVda5050ConnectionState('CONNECTIONBROKEN')).toBe('Degraded');
  });
});

describe('mapVda5050ActionStatus', () => {
  it('maps WAITING → Dispatched', () => {
    expect(mapVda5050ActionStatus('WAITING')).toBe('Dispatched');
  });
  it('maps INITIALIZING → Dispatched', () => {
    expect(mapVda5050ActionStatus('INITIALIZING')).toBe('Dispatched');
  });
  it('maps RUNNING → Executing', () => {
    expect(mapVda5050ActionStatus('RUNNING')).toBe('Executing');
  });
  it('maps PAUSED → WaitingPreemption', () => {
    expect(mapVda5050ActionStatus('PAUSED')).toBe('WaitingPreemption');
  });
  it('maps FINISHED → Succeeded', () => {
    expect(mapVda5050ActionStatus('FINISHED')).toBe('Succeeded');
  });
  it('maps FAILED → Failed', () => {
    expect(mapVda5050ActionStatus('FAILED')).toBe('Failed');
  });
});

// ── ID helpers ────────────────────────────────────────────────────────────────

describe('vda5050RobotId / vda5050FleetId', () => {
  it('builds stable RobotId from manufacturer + serialNumber', () => {
    const id = vda5050RobotId('KUKA', 'AGV-001');
    expect(String(id)).toBe('vda5050/KUKA/AGV-001');
  });

  it('builds stable FleetId from manufacturer', () => {
    const id = vda5050FleetId('KUKA');
    expect(String(id)).toBe('vda5050/KUKA');
  });

  it('produces different IDs for different robots', () => {
    const a = vda5050RobotId('KUKA', 'AGV-001');
    const b = vda5050RobotId('KUKA', 'AGV-002');
    expect(String(a)).not.toBe(String(b));
  });
});
