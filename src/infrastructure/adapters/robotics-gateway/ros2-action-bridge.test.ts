/**
 * Unit tests for Ros2ActionBridge.
 *
 * Bead: bead-0517
 */

import { describe, expect, it } from 'vitest';
import type {
  MissionDispatchRequest,
  MissionCancelRequest,
} from '../../../application/ports/mission-port.js';
import type { MissionActionRequestV1 } from '../../../domain/robots/mission-action-semantics-v1.js';
import { Ros2ActionBridge } from './ros2-action-bridge.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAction(actionName: string): MissionActionRequestV1 {
  return {
    schemaVersion: 1,
    missionId: 'mission-1' as never,
    robotId: 'robot-1' as never,
    gatewayId: 'gw-1' as never,
    actionType: 'robot:execute_action',
    actionName,
    parameters: { x: 1.0, y: 2.0, frame: 'map' },
    supportsPreemption: false,
    bypassTierEvaluation: false,
    completionMode: 'Auto',
    requiresOperatorConfirmation: false,
    requestedAt: new Date().toISOString(),
  };
}

function makeDispatchRequest(actionName = 'navigate_to'): MissionDispatchRequest {
  return {
    missionId: 'mission-1' as never,
    correlationId: 'corr-1' as never,
    planEffectIdempotencyKey: 'idem-1',
    action: makeAction(actionName),
  };
}

function makeCancelRequest(): MissionCancelRequest {
  return {
    missionId: 'no-such-mission' as never,
    correlationId: 'corr-1' as never,
    planEffectIdempotencyKey: 'idem-1',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Ros2ActionBridge', () => {
  describe('dispatchMission — unsupported action', () => {
    it('returns Rejected when actionName is not in ACTION_MAP', async () => {
      const bridge = new Ros2ActionBridge({
        rosbridgeUrl: 'ws://robot:9090',
        connectTimeoutMs: 100,
      });
      const result = await bridge.dispatchMission(makeDispatchRequest('fly_drone'));

      expect(result.kind).toBe('Rejected');
      if (result.kind === 'Rejected') {
        expect(result.reason).toBe('UnsupportedAction');
        expect(result.message).toContain('fly_drone');
      }
    });
  });

  describe('dispatchMission — gateway unreachable', () => {
    it('returns GatewayUnreachable when WebSocket connect times out', async () => {
      // Use an address that won't connect; short timeout so test is fast
      const bridge = new Ros2ActionBridge({
        rosbridgeUrl: 'ws://192.0.2.1:9090', // TEST-NET, not routable
        connectTimeoutMs: 50,
      });
      const result = await bridge.dispatchMission(makeDispatchRequest('navigate_to'));

      expect(result.kind).toBe('GatewayUnreachable');
    });
  });

  describe('getMissionStatus — unknown mission', () => {
    it('returns Pending for unknown missionId', async () => {
      const bridge = new Ros2ActionBridge({ rosbridgeUrl: 'ws://robot:9090' });
      const result = await bridge.getMissionStatus('unknown-mission' as never, 'corr-1' as never);
      expect(result.status).toBe('Pending');
    });
  });

  describe('cancelMission — no active mission', () => {
    it('returns accepted: false when mission not found', async () => {
      const bridge = new Ros2ActionBridge({ rosbridgeUrl: 'ws://robot:9090' });
      const result = await bridge.cancelMission(makeCancelRequest());
      expect(result.accepted).toBe(false);
    });
  });
});
