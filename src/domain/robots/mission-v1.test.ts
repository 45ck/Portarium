import { describe, expect, it } from 'vitest';
import {
  assertValidMissionStatusTransition,
  isTerminalMissionStatus,
  parseActionExecutionV1,
  parseMissionV1,
  transitionMissionStatusV1,
} from './mission-v1.js';

describe('parseMissionV1', () => {
  const baseMission = {
    schemaVersion: 1,
    missionId: 'mis-1001',
    robotId: 'robot-007',
    fleetId: 'fleet-1',
    goalSpec: { goal: 'navigate_to', waypoint: 'bay-3' },
    priority: 'High',
    constraints: { maxSpeedMps: 1.2, keepOutZones: ['z-a'] },
    status: 'Pending',
    idempotencyKey: 'mission-cmd-001',
  } as const;

  it('parses a mission aggregate', () => {
    const mission = parseMissionV1(baseMission);
    expect(mission.status).toBe('Pending');
    expect(mission.goalSpec).toEqual({ goal: 'navigate_to', waypoint: 'bay-3' });
  });

  it('rejects invalid status', () => {
    expect(() => parseMissionV1({ ...baseMission, status: 'Queued' })).toThrow(
      /status must be one of/i,
    );
  });
});

describe('parseActionExecutionV1', () => {
  it('parses execution entity with feedback log and preemptedAt', () => {
    const execution = parseActionExecutionV1({
      schemaVersion: 1,
      executionId: 'exec-42',
      missionId: 'mis-1001',
      gatewayRef: 'gw-edge-a',
      feedbackLog: [
        { at: '2026-02-19T12:00:00.000Z', level: 'Info', message: 'goal accepted' },
        { at: '2026-02-19T12:00:05.000Z', level: 'Warning', message: 'obstacle detected' },
      ],
      preemptedAt: '2026-02-19T12:00:10.000Z',
    });

    expect(execution.feedbackLog).toHaveLength(2);
    expect(execution.preemptedAt).toBe('2026-02-19T12:00:10.000Z');
  });
});

describe('mission status transitions', () => {
  const base = parseMissionV1({
    schemaVersion: 1,
    missionId: 'mis-1001',
    robotId: 'robot-007',
    goalSpec: { goal: 'navigate_to' },
    priority: 'Normal',
    constraints: {},
    status: 'Pending',
    idempotencyKey: 'mission-cmd-001',
  });

  it('supports pre-emption lifecycle Executing -> WaitingPreemption -> Executing', () => {
    const dispatched = transitionMissionStatusV1(base, 'Dispatched');
    const executing = transitionMissionStatusV1(dispatched, 'Executing');
    const waitingPreemption = transitionMissionStatusV1(executing, 'WaitingPreemption');
    const resumed = transitionMissionStatusV1(waitingPreemption, 'Executing');
    expect(resumed.status).toBe('Executing');
  });

  it('allows terminal transitions from executing', () => {
    const dispatched = transitionMissionStatusV1(base, 'Dispatched');
    const executing = transitionMissionStatusV1(dispatched, 'Executing');
    expect(transitionMissionStatusV1(executing, 'Succeeded').status).toBe('Succeeded');
    expect(transitionMissionStatusV1(executing, 'Failed').status).toBe('Failed');
    expect(transitionMissionStatusV1(executing, 'Cancelled').status).toBe('Cancelled');
  });

  it('rejects invalid transitions', () => {
    expect(() => assertValidMissionStatusTransition('Pending', 'Succeeded')).toThrow(
      /Invalid mission status transition/i,
    );
    expect(() => assertValidMissionStatusTransition('Succeeded', 'Executing')).toThrow(
      /Invalid mission status transition/i,
    );
  });

  it('marks terminal mission statuses', () => {
    expect(isTerminalMissionStatus('Succeeded')).toBe(true);
    expect(isTerminalMissionStatus('Failed')).toBe(true);
    expect(isTerminalMissionStatus('Cancelled')).toBe(true);
    expect(isTerminalMissionStatus('Executing')).toBe(false);
  });
});
