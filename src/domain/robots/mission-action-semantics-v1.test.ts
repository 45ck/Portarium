import { describe, expect, it } from 'vitest';
import {
  isStopPathAction,
  parseMissionActionRequestV1,
  parseMissionManualCompletionSignalV1,
} from './mission-action-semantics-v1.js';

describe('parseMissionActionRequestV1', () => {
  const base = {
    schemaVersion: 1,
    missionId: 'mis-001',
    robotId: 'robot-001',
    fleetId: 'fleet-001',
    gatewayId: 'gw-001',
    actionType: 'robot:execute_action',
    actionName: 'navigate_to',
    parameters: { waypoint: 'bay-3' },
    idempotencyKey: 'cmd-001',
    supportsPreemption: true,
    bypassTierEvaluation: false,
    completionMode: 'Auto',
    requiresOperatorConfirmation: false,
    requestedAt: '2026-02-19T10:00:00.000Z',
  } as const;

  it('parses a valid physical action request', () => {
    const parsed = parseMissionActionRequestV1(base);
    expect(parsed.actionType).toBe('robot:execute_action');
    expect(parsed.idempotencyKey).toBe('cmd-001');
  });

  it('requires idempotencyKey for physical actions', () => {
    const input = { ...base };
    delete (input as { idempotencyKey?: string }).idempotencyKey;
    expect(() => parseMissionActionRequestV1(input)).toThrow(/idempotencyKey is required/i);
  });

  it('requires stop-path actions to bypass tier evaluation', () => {
    expect(() =>
      parseMissionActionRequestV1({
        ...base,
        actionType: 'robot:stop',
        idempotencyKey: undefined,
        supportsPreemption: false,
        bypassTierEvaluation: false,
      }),
    ).toThrow(/bypassTierEvaluation=true/i);
  });

  it('requires execute_action to support preemption', () => {
    expect(() =>
      parseMissionActionRequestV1({
        ...base,
        supportsPreemption: false,
      }),
    ).toThrow(/supportsPreemption=true/i);
  });

  it('requires manual-only actions to request operator confirmation', () => {
    expect(() =>
      parseMissionActionRequestV1({
        ...base,
        completionMode: 'ManualOnly',
        requiresOperatorConfirmation: false,
      }),
    ).toThrow(/ManualOnly completion requires/i);
  });
});

describe('parseMissionManualCompletionSignalV1', () => {
  it('parses a valid manual completion payload', () => {
    const parsed = parseMissionManualCompletionSignalV1({
      schemaVersion: 1,
      missionId: 'mis-001',
      actionExecutionId: 'exec-001',
      operatorUserId: 'usr-1',
      outcome: 'Succeeded',
      confirmedAt: '2026-02-19T11:00:00.000Z',
      note: 'completed after visual inspection',
    });

    expect(parsed.outcome).toBe('Succeeded');
    expect(parsed.note).toContain('inspection');
  });
});

describe('isStopPathAction', () => {
  it('returns true for stop-path actions', () => {
    expect(isStopPathAction('robot:stop')).toBe(true);
    expect(isStopPathAction('robot:estop_request')).toBe(true);
    expect(isStopPathAction('robot:execute_action')).toBe(false);
  });
});
