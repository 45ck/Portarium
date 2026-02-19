import { describe, expect, it } from 'vitest';

import {
  CorrelationId,
  GatewayId,
  MissionId,
  RobotId,
  type CorrelationId as CorrelationIdType,
} from '../../domain/primitives/index.js';
import type {
  MissionCancelResult,
  MissionDispatchResult,
  MissionPort,
  MissionStatusResult,
} from './mission-port.js';

const missionId = MissionId('mission-1');
const correlationId: CorrelationIdType = CorrelationId('corr-1');

describe('MissionDispatchResult discriminant', () => {
  it('supports Dispatched', () => {
    const result: MissionDispatchResult = {
      kind: 'Dispatched',
      missionId,
      correlationId,
      planEffectIdempotencyKey: 'effect-1',
      gatewayRequestId: 'gateway-req-1',
      dispatchedAt: '2026-02-19T00:00:00.000Z',
    };
    expect(result.kind).toBe('Dispatched');
  });

  it('supports PolicyBlocked, GatewayUnreachable, and Rejected', () => {
    const blocked: MissionDispatchResult = {
      kind: 'PolicyBlocked',
      missionId,
      correlationId,
      planEffectIdempotencyKey: 'effect-2',
      policyReason: 'hazardous action requires approval',
    };
    const unreachable: MissionDispatchResult = {
      kind: 'GatewayUnreachable',
      missionId,
      correlationId,
      planEffectIdempotencyKey: 'effect-3',
      message: 'edge gateway timed out',
      retryAfterSeconds: 30,
    };
    const rejected: MissionDispatchResult = {
      kind: 'Rejected',
      missionId,
      correlationId,
      planEffectIdempotencyKey: 'effect-4',
      reason: 'UnsupportedAction',
      message: 'action is not supported by this gateway',
    };

    expect(blocked.kind).toBe('PolicyBlocked');
    expect(unreachable.kind).toBe('GatewayUnreachable');
    expect(rejected.kind).toBe('Rejected');
  });
});

describe('MissionPort stub compliance', () => {
  it('accepts in-memory stub with dispatch/cancel/status methods', async () => {
    const stub: MissionPort = {
      dispatchMission() {
        return Promise.resolve({
          kind: 'Dispatched',
          missionId,
          correlationId,
          planEffectIdempotencyKey: 'effect-1',
          gatewayRequestId: 'gateway-req-1',
          dispatchedAt: '2026-02-19T00:00:00.000Z',
        });
      },
      cancelMission() {
        const cancelled: MissionCancelResult = {
          accepted: true,
          cancelledAt: '2026-02-19T00:01:00.000Z',
        };
        return Promise.resolve(cancelled);
      },
      getMissionStatus() {
        const status: MissionStatusResult = {
          missionId,
          status: 'Executing',
          actionExecutionId: 'exec-1',
          observedAt: '2026-02-19T00:02:00.000Z',
        };
        return Promise.resolve(status);
      },
    };

    const dispatch = await stub.dispatchMission({
      missionId,
      correlationId,
      planEffectIdempotencyKey: 'effect-1',
      action: {
        schemaVersion: 1,
        missionId,
        robotId: RobotId('robot-1'),
        gatewayId: GatewayId('gateway-1'),
        actionType: 'robot:execute_action',
        actionName: 'NavigateTo',
        parameters: { x: 10, y: 20 },
        idempotencyKey: 'mission-cmd-1',
        supportsPreemption: true,
        bypassTierEvaluation: false,
        completionMode: 'Auto',
        requiresOperatorConfirmation: false,
        requestedAt: '2026-02-19T00:00:00.000Z',
      },
    });
    const cancel = await stub.cancelMission({
      missionId,
      correlationId,
      planEffectIdempotencyKey: 'effect-1',
      reason: 'operator request',
    });
    const status = await stub.getMissionStatus(missionId, correlationId);

    expect(dispatch.kind).toBe('Dispatched');
    expect(cancel.accepted).toBe(true);
    expect(status.status).toBe('Executing');
  });
});
