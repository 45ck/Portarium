/**
 * Unit tests for OpcUaMissionGateway.
 *
 * Uses the injectable OpcUaClientFactory to avoid real OPC UA connections.
 *
 * Bead: bead-0518
 */

import { describe, expect, it, vi } from 'vitest';
import type {
  MissionDispatchRequest,
  MissionCancelRequest,
} from '../../../application/ports/mission-port.js';
import type { MissionActionRequestV1 } from '../../../domain/robots/mission-action-semantics-v1.js';
import { OpcUaMissionGateway, type OpcUaClientFactory } from './opcua-mission-gateway.js';

// ── Mock factory helpers ──────────────────────────────────────────────────────

type CallResult = { statusCode: number; outputArguments: Array<{ value: unknown }> };

function makeFactory(callResult: CallResult | Error): OpcUaClientFactory {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockCall = vi.fn() as any;
  if (callResult instanceof Error) {
    mockCall.mockRejectedValue(callResult);
  } else {
    mockCall.mockResolvedValue(callResult);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async () => ({
    client: { DataType: { String: 12 } } as any,
    session: { call: mockCall, close: vi.fn().mockResolvedValue(undefined) },
    cleanup: vi.fn().mockResolvedValue(undefined),
  });
}

function makeConnectFailFactory(): OpcUaClientFactory {
  return async () => {
    throw new Error('ECONNREFUSED');
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAction(actionName: string): MissionActionRequestV1 {
  return {
    schemaVersion: 1,
    missionId: 'mission-1' as never,
    robotId: 'robot-1' as never,
    gatewayId: 'gw-1' as never,
    actionType: 'robot:execute_action',
    actionName,
    parameters: { speed: 0.5 },
    supportsPreemption: false,
    bypassTierEvaluation: false,
    completionMode: 'Auto',
    requiresOperatorConfirmation: false,
    requestedAt: new Date().toISOString(),
  };
}

function makeDispatchRequest(actionName = 'move_to_pose'): MissionDispatchRequest {
  return {
    missionId: 'mission-1' as never,
    correlationId: 'corr-1' as never,
    planEffectIdempotencyKey: 'idem-1',
    action: makeAction(actionName),
  };
}

function makeCancelRequest(): MissionCancelRequest {
  return {
    missionId: 'mission-1' as never,
    correlationId: 'corr-1' as never,
    planEffectIdempotencyKey: 'idem-1',
  };
}

function makeGateway(factory: OpcUaClientFactory) {
  return new OpcUaMissionGateway(
    { endpointUrl: 'opc.tcp://plc.local:4840', namespaceIndex: 1, objectPath: 'Portarium.Mission' },
    factory,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OpcUaMissionGateway', () => {
  describe('dispatchMission', () => {
    it('returns Dispatched on Good OPC UA status', async () => {
      const gw = makeGateway(makeFactory({ statusCode: 0, outputArguments: [{ value: 'gw-req-42' }] }));
      const result = await gw.dispatchMission(makeDispatchRequest());

      expect(result.kind).toBe('Dispatched');
      if (result.kind === 'Dispatched') {
        expect(result.gatewayRequestId).toBe('gw-req-42');
        expect(result.dispatchedAt).toBeDefined();
      }
    });

    it('returns GatewayUnreachable on non-Good OPC UA status', async () => {
      const gw = makeGateway(makeFactory({ statusCode: 0x80350000, outputArguments: [] }));
      const result = await gw.dispatchMission(makeDispatchRequest());

      expect(result.kind).toBe('GatewayUnreachable');
    });

    it('returns GatewayUnreachable when connect throws', async () => {
      const gw = makeGateway(makeConnectFailFactory());
      const result = await gw.dispatchMission(makeDispatchRequest());

      expect(result.kind).toBe('GatewayUnreachable');
      if (result.kind === 'GatewayUnreachable') {
        expect(result.message).toContain('ECONNREFUSED');
      }
    });
  });

  describe('cancelMission', () => {
    it('returns accepted: true on Good OPC UA status', async () => {
      const gw = makeGateway(makeFactory({ statusCode: 0, outputArguments: [] }));
      const result = await gw.cancelMission(makeCancelRequest());

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.cancelledAt).toBeDefined();
      }
    });

    it('returns accepted: false on non-Good OPC UA status', async () => {
      const gw = makeGateway(makeFactory({ statusCode: 0x80350000, outputArguments: [] }));
      const result = await gw.cancelMission(makeCancelRequest());

      expect(result.accepted).toBe(false);
    });
  });

  describe('getMissionStatus', () => {
    it('maps SUCCEEDED result code to Succeeded status', async () => {
      const gw = makeGateway(makeFactory({
        statusCode: 0,
        outputArguments: [{ value: 'SUCCEEDED' }, { value: 'action-exec-1' }],
      }));
      const result = await gw.getMissionStatus('mission-1' as never, 'corr-1' as never);

      expect(result.status).toBe('Succeeded');
      expect(result.actionExecutionId).toBe('action-exec-1');
    });

    it('maps EXECUTING result code to Executing status', async () => {
      const gw = makeGateway(makeFactory({ statusCode: 0, outputArguments: [{ value: 'EXECUTING' }] }));
      const result = await gw.getMissionStatus('mission-1' as never, 'corr-1' as never);

      expect(result.status).toBe('Executing');
    });

    it('returns Failed status on non-Good OPC UA status', async () => {
      const gw = makeGateway(makeFactory({ statusCode: 0x80350000, outputArguments: [] }));
      const result = await gw.getMissionStatus('mission-1' as never, 'corr-1' as never);

      expect(result.status).toBe('Failed');
    });

    it('returns Failed status when session call throws', async () => {
      const gw = makeGateway(makeFactory(new Error('session timeout')));
      const result = await gw.getMissionStatus('mission-1' as never, 'corr-1' as never);

      expect(result.status).toBe('Failed');
    });
  });

  describe('resultCodeToStatus mapping', () => {
    const mappings: Array<[string, string]> = [
      ['DISPATCHED', 'Dispatched'],
      ['CANCELLED', 'Cancelled'],
      ['CANCELED', 'Cancelled'],
      ['FAILED', 'Failed'],
      ['UNKNOWN_CODE', 'Failed'],
    ];

    for (const [code, expected] of mappings) {
      it(`maps ${code} → ${expected}`, async () => {
        const gw = makeGateway(makeFactory({ statusCode: 0, outputArguments: [{ value: code }] }));
        const result = await gw.getMissionStatus('m' as never, 'c' as never);
        expect(result.status).toBe(expected);
      });
    }
  });
});
