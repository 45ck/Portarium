/**
 * Unit tests for Open-RMF fleet coordination ingest adapter.
 *
 * Validates FleetState parsing, TaskSummary parsing, API robot summary parsing,
 * domain mapping, and multi-robot fleet coordination helpers.
 *
 * Bead: bead-0530
 */

import { describe, expect, it } from 'vitest';
import {
  parseOpenRmfFleetState,
  parseOpenRmfTaskSummary,
  parseOpenRmfApiRobotSummary,
  mapOpenRmfRobotModeToConnectivity,
  mapOpenRmfTaskState,
  mapOpenRmfModeStringToConnectivity,
  openRmfRobotId,
  openRmfFleetId,
  extractFleetRobotIds,
  findRobotByTaskId,
  OpenRmfParseError,
} from './open-rmf-fleet-ingest.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRobotState(name: string, mode: number, taskId: string = '') {
  return {
    name,
    model: 'TurtleBot4',
    task_id: taskId,
    seq: 1,
    mode: { mode },
    battery_percent: 80,
    location: {
      t: { sec: 1708603200, nanosec: 0 },
      x: 1.0,
      y: 2.0,
      yaw: 0.0,
      obey_approach_speed_limit: false,
      level_name: 'L1',
    },
    path: [],
  };
}

const MINIMAL_FLEET_STATE = {
  name: 'warehouse-fleet',
  robots: [
    makeRobotState('robot-1', 2 /* MOVING */, 'task-abc'),
    makeRobotState('robot-2', 0 /* IDLE */),
  ],
};

// ── FleetState parsing ────────────────────────────────────────────────────────

describe('parseOpenRmfFleetState', () => {
  it('parses a valid FleetState with two robots', () => {
    const result = parseOpenRmfFleetState(MINIMAL_FLEET_STATE);
    expect(result.name).toBe('warehouse-fleet');
    expect(result.robots).toHaveLength(2);
    expect(result.robots[0]!.name).toBe('robot-1');
  });

  it('parses a FleetState with an empty robots array', () => {
    const result = parseOpenRmfFleetState({ name: 'empty-fleet', robots: [] });
    expect(result.robots).toHaveLength(0);
  });

  it('throws OpenRmfParseError when name is missing', () => {
    expect(() => parseOpenRmfFleetState({ robots: [] })).toThrow(OpenRmfParseError);
  });

  it('throws OpenRmfParseError when robots is not an array', () => {
    expect(() => parseOpenRmfFleetState({ name: 'f', robots: null })).toThrow(OpenRmfParseError);
  });

  it('throws OpenRmfParseError for non-object payload', () => {
    expect(() => parseOpenRmfFleetState('string')).toThrow(OpenRmfParseError);
    expect(() => parseOpenRmfFleetState(null)).toThrow(OpenRmfParseError);
    expect(() => parseOpenRmfFleetState([])).toThrow(OpenRmfParseError);
  });
});

// ── TaskSummary parsing ───────────────────────────────────────────────────────

describe('parseOpenRmfTaskSummary', () => {
  it('parses a valid ACTIVE task', () => {
    const msg = {
      task_id: 'task-001',
      fleet_name: 'warehouse',
      robot_name: 'robot-1',
      state: 'ACTIVE',
    };
    const result = parseOpenRmfTaskSummary(msg);
    expect(result.task_id).toBe('task-001');
    expect(result.state).toBe('ACTIVE');
  });

  it('parses all valid task states', () => {
    const states = ['PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELED', 'KILLED'] as const;
    for (const state of states) {
      const result = parseOpenRmfTaskSummary({ task_id: 't', state });
      expect(result.state).toBe(state);
    }
  });

  it('throws OpenRmfParseError when task_id is missing', () => {
    expect(() => parseOpenRmfTaskSummary({ state: 'ACTIVE' })).toThrow(OpenRmfParseError);
  });

  it('throws OpenRmfParseError for invalid state', () => {
    expect(() => parseOpenRmfTaskSummary({ task_id: 't', state: 'IN_PROGRESS' })).toThrow(
      OpenRmfParseError,
    );
    expect(() => parseOpenRmfTaskSummary({ task_id: 't', state: '' })).toThrow(OpenRmfParseError);
  });
});

// ── API robot summary parsing ─────────────────────────────────────────────────

describe('parseOpenRmfApiRobotSummary', () => {
  it('parses a valid API robot summary', () => {
    const msg = {
      fleet_name: 'warehouse-fleet',
      robot_name: 'robot-1',
      status: { mode: 'MOVING', battery_percent: 75, task_id: 'task-abc' },
    };
    const result = parseOpenRmfApiRobotSummary(msg);
    expect(result.fleet_name).toBe('warehouse-fleet');
    expect(result.robot_name).toBe('robot-1');
    expect(result.status.mode).toBe('MOVING');
  });

  it('throws OpenRmfParseError when fleet_name is missing', () => {
    expect(() => parseOpenRmfApiRobotSummary({ robot_name: 'r', status: {} })).toThrow(
      OpenRmfParseError,
    );
  });

  it('throws OpenRmfParseError when status is not an object', () => {
    expect(() =>
      parseOpenRmfApiRobotSummary({ fleet_name: 'f', robot_name: 'r', status: 'bad' }),
    ).toThrow(OpenRmfParseError);
  });
});

// ── Domain mapping ────────────────────────────────────────────────────────────

describe('mapOpenRmfRobotModeToConnectivity', () => {
  it('IDLE (0) → Online', () => {
    expect(mapOpenRmfRobotModeToConnectivity(0)).toBe('Online');
  });
  it('CHARGING (1) → Online', () => {
    expect(mapOpenRmfRobotModeToConnectivity(1)).toBe('Online');
  });
  it('MOVING (2) → Online', () => {
    expect(mapOpenRmfRobotModeToConnectivity(2)).toBe('Online');
  });
  it('PAUSING (3) → Online', () => {
    expect(mapOpenRmfRobotModeToConnectivity(3)).toBe('Online');
  });
  it('WAITING (4) → Online', () => {
    expect(mapOpenRmfRobotModeToConnectivity(4)).toBe('Online');
  });
  it('EMERGENCY (5) → Degraded', () => {
    expect(mapOpenRmfRobotModeToConnectivity(5)).toBe('Degraded');
  });
  it('ADAPTER_ERROR (8) → Degraded', () => {
    expect(mapOpenRmfRobotModeToConnectivity(8)).toBe('Degraded');
  });
  it('unknown ordinal → Degraded (fail-safe)', () => {
    expect(mapOpenRmfRobotModeToConnectivity(99)).toBe('Degraded');
  });
});

describe('mapOpenRmfTaskState', () => {
  it('PENDING → Dispatched', () => {
    expect(mapOpenRmfTaskState('PENDING')).toBe('Dispatched');
  });
  it('ACTIVE → Executing', () => {
    expect(mapOpenRmfTaskState('ACTIVE')).toBe('Executing');
  });
  it('COMPLETED → Succeeded', () => {
    expect(mapOpenRmfTaskState('COMPLETED')).toBe('Succeeded');
  });
  it('FAILED → Failed', () => {
    expect(mapOpenRmfTaskState('FAILED')).toBe('Failed');
  });
  it('CANCELED → Cancelled', () => {
    expect(mapOpenRmfTaskState('CANCELED')).toBe('Cancelled');
  });
  it('KILLED → Cancelled', () => {
    expect(mapOpenRmfTaskState('KILLED')).toBe('Cancelled');
  });
});

describe('mapOpenRmfModeStringToConnectivity', () => {
  it('MOVING → Online', () => {
    expect(mapOpenRmfModeStringToConnectivity('MOVING')).toBe('Online');
  });
  it('EMERGENCY → Degraded', () => {
    expect(mapOpenRmfModeStringToConnectivity('EMERGENCY')).toBe('Degraded');
  });
  it('unknown string → Unknown', () => {
    expect(mapOpenRmfModeStringToConnectivity('DANCING')).toBe('Unknown');
  });
  it('is case-insensitive', () => {
    expect(mapOpenRmfModeStringToConnectivity('idle')).toBe('Online');
    expect(mapOpenRmfModeStringToConnectivity('Moving')).toBe('Online');
  });
});

// ── ID helpers ────────────────────────────────────────────────────────────────

describe('openRmfRobotId / openRmfFleetId', () => {
  it('builds stable RobotId from fleet + robot name', () => {
    const id = openRmfRobotId('warehouse-fleet', 'robot-1');
    expect(String(id)).toBe('openrmf/warehouse-fleet/robot-1');
  });

  it('builds stable FleetId from fleet name', () => {
    const id = openRmfFleetId('warehouse-fleet');
    expect(String(id)).toBe('openrmf/warehouse-fleet');
  });

  it('produces unique IDs for different robots in same fleet', () => {
    const a = openRmfRobotId('fleet', 'robot-1');
    const b = openRmfRobotId('fleet', 'robot-2');
    expect(String(a)).not.toBe(String(b));
  });

  it('produces unique IDs for same robot name in different fleets', () => {
    const a = openRmfRobotId('fleet-a', 'robot-1');
    const b = openRmfRobotId('fleet-b', 'robot-1');
    expect(String(a)).not.toBe(String(b));
  });
});

// ── Multi-robot fleet helpers ─────────────────────────────────────────────────

describe('extractFleetRobotIds', () => {
  it('returns one entry per robot with correct IDs', () => {
    const fleet = parseOpenRmfFleetState(MINIMAL_FLEET_STATE);
    const ids = extractFleetRobotIds(fleet);

    expect(ids).toHaveLength(2);
    expect(ids[0]!.fleetName).toBe('warehouse-fleet');
    expect(ids[0]!.robotName).toBe('robot-1');
    expect(String(ids[0]!.robotId)).toBe('openrmf/warehouse-fleet/robot-1');
    expect(String(ids[1]!.robotId)).toBe('openrmf/warehouse-fleet/robot-2');
  });

  it('returns empty array for a fleet with no robots', () => {
    const fleet = parseOpenRmfFleetState({ name: 'empty', robots: [] });
    expect(extractFleetRobotIds(fleet)).toHaveLength(0);
  });
});

describe('findRobotByTaskId', () => {
  it('returns the robot currently executing the given task', () => {
    const fleet = parseOpenRmfFleetState(MINIMAL_FLEET_STATE);
    const robot = findRobotByTaskId(fleet, 'task-abc');
    expect(robot).not.toBeNull();
    expect(robot!.name).toBe('robot-1');
  });

  it('returns null when no robot has that task_id', () => {
    const fleet = parseOpenRmfFleetState(MINIMAL_FLEET_STATE);
    expect(findRobotByTaskId(fleet, 'nonexistent-task')).toBeNull();
  });

  it('returns null for an empty fleet', () => {
    const fleet = parseOpenRmfFleetState({ name: 'empty', robots: [] });
    expect(findRobotByTaskId(fleet, 'task-abc')).toBeNull();
  });
});
