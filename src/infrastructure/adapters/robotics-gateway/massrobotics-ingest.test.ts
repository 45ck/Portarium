/**
 * Unit tests for MassRobotics AMR Interoperability Standard ingest adapter.
 *
 * Validates status message parsing, identity message parsing, and
 * domain mapping for MassRobotics v1.1 payloads.
 *
 * Bead: bead-0567
 */

import { describe, expect, it } from 'vitest';
import {
  parseMassRoboticsStatusMessage,
  parseMassRoboticsIdentityMessage,
  mapMassRoboticsOperationalState,
  mapMassRoboticsTaskState,
  massRoboticsRobotId,
  massRoboticsFleetId,
  MassRoboticsParseError,
} from './massrobotics-ingest.js';

// ── Status message parsing ────────────────────────────────────────────────────

const MINIMAL_STATUS = {
  robotId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  timestamp: '2026-02-22T14:00:00.000Z',
  operationalState: 'IDLE',
};

describe('parseMassRoboticsStatusMessage', () => {
  it('parses a minimal valid status message', () => {
    const result = parseMassRoboticsStatusMessage(MINIMAL_STATUS);
    expect(result.robotId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(result.operationalState).toBe('IDLE');
  });

  it('parses a full status message with location and task state', () => {
    const msg = {
      ...MINIMAL_STATUS,
      operationalState: 'MOVING',
      taskState: 'EXECUTING',
      taskId: 'mission-xyz',
      location: { x: 10.5, y: 3.2, angle: 90.0, mapId: 'warehouse-floor-1' },
      batteryState: { batteryPercentage: 72, isCharging: false },
      manufacturer: 'Boston Dynamics',
      model: 'Spot',
      softwareVersion: '3.3.0',
    };
    const result = parseMassRoboticsStatusMessage(msg);
    expect(result.operationalState).toBe('MOVING');
    expect(result.taskState).toBe('EXECUTING');
    expect(result.taskId).toBe('mission-xyz');
    expect(result.location?.x).toBe(10.5);
    expect(result.batteryState?.batteryPercentage).toBe(72);
  });

  it('parses ERROR state with errorDescription', () => {
    const msg = {
      ...MINIMAL_STATUS,
      operationalState: 'ERROR',
      errorDescription: 'Motor driver fault on wheel FL',
    };
    const result = parseMassRoboticsStatusMessage(msg);
    expect(result.operationalState).toBe('ERROR');
    expect(result.errorDescription).toBe('Motor driver fault on wheel FL');
  });

  it('throws MassRoboticsParseError when robotId is missing', () => {
    const { robotId: _, ...noId } = MINIMAL_STATUS;
    expect(() => parseMassRoboticsStatusMessage(noId)).toThrow(MassRoboticsParseError);
  });

  it('throws MassRoboticsParseError for invalid operationalState', () => {
    const msg = { ...MINIMAL_STATUS, operationalState: 'DANCING' };
    expect(() => parseMassRoboticsStatusMessage(msg)).toThrow(MassRoboticsParseError);
  });

  it('throws MassRoboticsParseError for invalid taskState', () => {
    const msg = { ...MINIMAL_STATUS, taskState: 'IN_PROGRESS' };
    expect(() => parseMassRoboticsStatusMessage(msg)).toThrow(MassRoboticsParseError);
  });

  it('throws MassRoboticsParseError for non-object payload', () => {
    expect(() => parseMassRoboticsStatusMessage(null)).toThrow(MassRoboticsParseError);
    expect(() => parseMassRoboticsStatusMessage('string')).toThrow(MassRoboticsParseError);
    expect(() => parseMassRoboticsStatusMessage(42)).toThrow(MassRoboticsParseError);
  });
});

// ── Identity message parsing ──────────────────────────────────────────────────

describe('parseMassRoboticsIdentityMessage', () => {
  it('parses a valid identity message', () => {
    const msg = {
      robotId: 'uuid-123',
      manufacturer: 'Boston Dynamics',
      model: 'Spot',
      softwareVersion: '3.3.0',
      supportedInterfaces: ['MassRobotics/v1.1', 'VDA5050/v2'],
    };
    const result = parseMassRoboticsIdentityMessage(msg);
    expect(result.manufacturer).toBe('Boston Dynamics');
    expect(result.model).toBe('Spot');
    expect(result.supportedInterfaces).toContain('MassRobotics/v1.1');
  });

  it('throws when manufacturer is missing', () => {
    expect(() =>
      parseMassRoboticsIdentityMessage({ robotId: 'id', model: 'X' }),
    ).toThrow(MassRoboticsParseError);
  });

  it('throws when model is missing', () => {
    expect(() =>
      parseMassRoboticsIdentityMessage({ robotId: 'id', manufacturer: 'M' }),
    ).toThrow(MassRoboticsParseError);
  });
});

// ── Domain mapping ────────────────────────────────────────────────────────────

describe('mapMassRoboticsOperationalState', () => {
  it('maps IDLE → Online', () => { expect(mapMassRoboticsOperationalState('IDLE')).toBe('Online'); });
  it('maps MOVING → Online', () => { expect(mapMassRoboticsOperationalState('MOVING')).toBe('Online'); });
  it('maps CHARGING → Online', () => { expect(mapMassRoboticsOperationalState('CHARGING')).toBe('Online'); });
  it('maps PAUSED → Online', () => { expect(mapMassRoboticsOperationalState('PAUSED')).toBe('Online'); });
  it('maps ERROR → Degraded', () => { expect(mapMassRoboticsOperationalState('ERROR')).toBe('Degraded'); });
  it('maps OFFLINE → Offline', () => { expect(mapMassRoboticsOperationalState('OFFLINE')).toBe('Offline'); });
  it('maps UNKNOWN → Unknown', () => { expect(mapMassRoboticsOperationalState('UNKNOWN')).toBe('Unknown'); });
});

describe('mapMassRoboticsTaskState', () => {
  it('maps ASSIGNED → Dispatched', () => { expect(mapMassRoboticsTaskState('ASSIGNED')).toBe('Dispatched'); });
  it('maps EXECUTING → Executing', () => { expect(mapMassRoboticsTaskState('EXECUTING')).toBe('Executing'); });
  it('maps COMPLETED → Succeeded', () => { expect(mapMassRoboticsTaskState('COMPLETED')).toBe('Succeeded'); });
  it('maps FAILED → Failed', () => { expect(mapMassRoboticsTaskState('FAILED')).toBe('Failed'); });
  it('maps CANCELLED → Cancelled', () => { expect(mapMassRoboticsTaskState('CANCELLED')).toBe('Cancelled'); });
  it('returns null when taskState is undefined', () => {
    expect(mapMassRoboticsTaskState(undefined)).toBeNull();
  });
});

// ── ID helpers ────────────────────────────────────────────────────────────────

describe('massRoboticsRobotId / massRoboticsFleetId', () => {
  it('builds stable RobotId from UUID', () => {
    const id = massRoboticsRobotId('uuid-123');
    expect(String(id)).toBe('massrobotics/uuid-123');
  });

  it('builds stable FleetId from manufacturer', () => {
    const id = massRoboticsFleetId('Boston Dynamics');
    expect(String(id)).toBe('massrobotics/Boston Dynamics');
  });

  it('produces different IDs for different robots', () => {
    const a = massRoboticsRobotId('uuid-1');
    const b = massRoboticsRobotId('uuid-2');
    expect(String(a)).not.toBe(String(b));
  });
});
