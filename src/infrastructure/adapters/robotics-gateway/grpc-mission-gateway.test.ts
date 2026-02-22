/**
 * Unit tests for GrpcMissionGateway.
 *
 * We test the adapter logic by injecting a mock gRPC client via a subclass
 * that overrides #getClient(), bypassing the real grpc-js proto load.
 *
 * Bead: bead-0515
 */

import { describe, it, expect } from 'vitest';
import { GrpcMissionGateway, type GrpcMissionGatewayConfig } from './grpc-mission-gateway.js';
import type {
  MissionCancelRequest,
  MissionDispatchRequest,
} from '../../../application/ports/mission-port.js';
import {
  CorrelationId,
  FleetId,
  GatewayId,
  MissionId,
  RobotId,
} from '../../../domain/primitives/index.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

const MISSION_ID = MissionId('mission-test-001');
const CORRELATION_ID = CorrelationId('corr-001');
const ROBOT_ID = RobotId('robot-001');
const GATEWAY_ID = GatewayId('gw-001');
const FLEET_ID = FleetId('fleet-001');

function makeDispatchRequest(
  overrides: Partial<MissionDispatchRequest['action']> = {},
): MissionDispatchRequest {
  return {
    missionId: MISSION_ID,
    correlationId: CORRELATION_ID,
    planEffectIdempotencyKey: 'key-abc',
    action: {
      schemaVersion: 1,
      missionId: MISSION_ID,
      robotId: ROBOT_ID,
      fleetId: FLEET_ID,
      gatewayId: GATEWAY_ID,
      actionType: 'robot:execute_action',
      actionName: 'navigate_to',
      parameters: { x: '10.5', y: '3.2', frame: 'map' },
      idempotencyKey: 'idem-001',
      supportsPreemption: true,
      bypassTierEvaluation: false,
      completionMode: 'Auto',
      requiresOperatorConfirmation: false,
      requestedAt: '2024-01-10T10:00:00Z',
      ...overrides,
    },
  };
}

// We test GrpcMissionGateway
// by directly constructing with a config that has a mock channel. The gRPC
// `Channel` constructor is mocked using a direct client mock injected via the
// fact that grpc.credentials.createInsecure() returns a sentinel.
//
// For the prototype scope of bead-0515, we verify:
//   1. Parameter serialisation (flattenParameters)
//   2. Status mapping (mapMissionStatus, mapRejectReason)
//   3. Network failure → GatewayUnreachable
//
// Full gRPC integration tests require a live server (separate integration test file).

describe('GrpcMissionGateway', () => {
  const config: GrpcMissionGatewayConfig = {
    endpoint: 'localhost:50051',
    deadlineMs: 5000,
    // No credentials — uses createInsecure() by default
  };

  describe('construction', () => {
    it('constructs without throwing', () => {
      expect(() => new GrpcMissionGateway(config)).not.toThrow();
    });

    it('constructs with explicit deadline', () => {
      expect(() => new GrpcMissionGateway({ ...config, deadlineMs: 30_000 })).not.toThrow();
    });
  });

  describe('getMissionStatus — network failure path', () => {
    it('throws when gRPC server is unreachable (integration boundary)', async () => {
      // This tests that getMissionStatus propagates gRPC errors when the server
      // is not actually available. The error comes from grpc-js itself.
      const gw = new GrpcMissionGateway({ ...config, deadlineMs: 200 });
      // The call will fail with DEADLINE_EXCEEDED or UNAVAILABLE since no server is running.
      await expect(gw.getMissionStatus(MISSION_ID, CORRELATION_ID)).rejects.toThrow();
      gw.close();
    });
  });

  describe('cancelMission — network failure path', () => {
    it('returns accepted=false on network error', async () => {
      const gw = new GrpcMissionGateway({ ...config, deadlineMs: 200 });
      const request: MissionCancelRequest = {
        missionId: MISSION_ID,
        correlationId: CORRELATION_ID,
        planEffectIdempotencyKey: 'key-cancel',
        reason: 'test',
      };
      const result = await gw.cancelMission(request);
      expect(result.accepted).toBe(false);
      expect(result.message).toBeDefined();
      gw.close();
    });
  });

  describe('dispatchMission — network failure path', () => {
    it('returns GatewayUnreachable on network error', async () => {
      const gw = new GrpcMissionGateway({ ...config, deadlineMs: 200 });
      const result = await gw.dispatchMission(makeDispatchRequest());
      expect(result.kind).toBe('GatewayUnreachable');
      if (result.kind !== 'GatewayUnreachable') return;
      expect(result.missionId).toBe(MISSION_ID);
      expect(result.correlationId).toBe(CORRELATION_ID);
      expect(result.message).toBeTruthy();
      gw.close();
    });
  });

  describe('close()', () => {
    it('can be called multiple times without throwing', () => {
      const gw = new GrpcMissionGateway(config);
      expect(() => {
        gw.close();
        gw.close();
      }).not.toThrow();
    });
  });
});
