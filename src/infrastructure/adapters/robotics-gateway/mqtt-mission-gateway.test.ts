import { describe, it, expect, vi } from 'vitest';
import { MqttMissionGateway, type MqttBrokerApiConfig } from './mqtt-mission-gateway.js';
import type { MissionDispatchRequest, MissionCancelRequest } from '../../../application/ports/mission-port.js';
import { CorrelationId, FleetId, GatewayId, MissionId, RobotId } from '../../../domain/primitives/index.js';
import { TenantId } from '../../../domain/primitives/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MISSION_ID = MissionId('mission-mqtt-001');
const CORRELATION_ID = CorrelationId('corr-mqtt-001');
const ROBOT_ID = RobotId('robot-mqtt-001');

const DEFAULT_CONFIG: MqttBrokerApiConfig = {
  apiBaseUrl: 'https://broker.example.com/api/v5',
  apiToken: 'test-token',
  tenantId: String(TenantId('tenant-mqtt-test')),
  flavour: 'emqx',
};

function okFetch(body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

function makeDispatchRequest(): MissionDispatchRequest {
  return {
    missionId: MISSION_ID,
    correlationId: CORRELATION_ID,
    planEffectIdempotencyKey: 'key-mqtt-001',
    action: {
      schemaVersion: 1,
      missionId: MISSION_ID,
      robotId: ROBOT_ID,
      fleetId: FleetId('fleet-001'),
      gatewayId: GatewayId('gw-001'),
      actionType: 'robot:execute_action',
      actionName: 'navigate_to',
      parameters: { x: 5, y: 10 },
      idempotencyKey: 'idem-001',
      supportsPreemption: true,
      bypassTierEvaluation: false,
      completionMode: 'Auto',
      requiresOperatorConfirmation: false,
      requestedAt: '2024-01-10T10:00:00Z',
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MqttMissionGateway', () => {
  describe('dispatchMission', () => {
    it('publishes to command topic and returns Dispatched', async () => {
      const fetchFn = okFetch();
      const gw = new MqttMissionGateway(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await gw.dispatchMission(makeDispatchRequest());

      expect(result.kind).toBe('Dispatched');
      if (result.kind !== 'Dispatched') return;
      expect(result.missionId).toBe(MISSION_ID);
      expect(result.correlationId).toBe(CORRELATION_ID);
      expect(result.gatewayRequestId).toMatch(/mqtt-/);

      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/publish');
      expect(init.method).toBe('POST');

      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(String(body['topic'])).toContain(`robots/${ROBOT_ID}/commands/${MISSION_ID}`);
      expect(body['qos']).toBe(1);
      expect(body['retain']).toBe(false);
    });

    it('returns GatewayUnreachable on network failure', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const gw = new MqttMissionGateway(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await gw.dispatchMission(makeDispatchRequest());

      expect(result.kind).toBe('GatewayUnreachable');
      if (result.kind !== 'GatewayUnreachable') return;
      expect(result.message).toContain('ECONNREFUSED');
    });

    it('returns GatewayUnreachable on HTTP 503', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      });
      const gw = new MqttMissionGateway(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await gw.dispatchMission(makeDispatchRequest());

      expect(result.kind).toBe('GatewayUnreachable');
    });
  });

  describe('cancelMission', () => {
    it('publishes to cancel topic and returns accepted=true', async () => {
      const fetchFn = okFetch();
      const gw = new MqttMissionGateway(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const request: MissionCancelRequest = {
        missionId: MISSION_ID,
        correlationId: CORRELATION_ID,
        planEffectIdempotencyKey: 'key-cancel',
        reason: 'operator_stop',
      };
      const result = await gw.cancelMission(request);

      expect(result.accepted).toBe(true);
      expect(result.cancelledAt).toBeDefined();

      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(String(body['topic'])).toContain(`missions/${MISSION_ID}/cancel`);
    });

    it('returns accepted=false on broker error', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('broker down'));
      const gw = new MqttMissionGateway(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await gw.cancelMission({
        missionId: MISSION_ID,
        correlationId: CORRELATION_ID,
        planEffectIdempotencyKey: 'key-cancel',
      });

      expect(result.accepted).toBe(false);
      expect(result.message).toContain('broker down');
    });
  });

  describe('getMissionStatus', () => {
    it('returns status from retained message', async () => {
      const retainedPayload = {
        status: 'executing',
        action_execution_id: 'exec-001',
        observed_at: '2024-01-10T10:05:00Z',
      };
      const retainedMsg = {
        schemaVersion: 1,
        sentAt: '2024-01-10T10:05:00Z',
        payload: retainedPayload,
      };
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          payload: Buffer.from(JSON.stringify(retainedMsg)).toString('base64'),
        }),
      });
      const gw = new MqttMissionGateway(
        { ...DEFAULT_CONFIG, statusPollIntervalMs: 0, statusPollMaxAttempts: 1 },
        fetchFn as typeof fetch,
      );

      const result = await gw.getMissionStatus(MISSION_ID, CORRELATION_ID);

      expect(result.status).toBe('Executing');
      expect(result.actionExecutionId).toBe('exec-001');
      expect(result.observedAt).toBe('2024-01-10T10:05:00Z');
    });

    it('returns Pending when no retained message found', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      const noopSleep = vi.fn().mockResolvedValue(undefined);
      const gw = new MqttMissionGateway(
        { ...DEFAULT_CONFIG, statusPollMaxAttempts: 2, statusPollIntervalMs: 0 },
        fetchFn as typeof fetch,
        noopSleep,
      );

      const result = await gw.getMissionStatus(MISSION_ID, CORRELATION_ID);

      expect(result.status).toBe('Pending');
    });
  });

  describe('topic structure', () => {
    it('encodes tenant and robot in command topic', async () => {
      const fetchFn = okFetch();
      const gw = new MqttMissionGateway(
        { ...DEFAULT_CONFIG, tenantId: 'my-tenant' },
        fetchFn as typeof fetch,
      );

      await gw.dispatchMission(makeDispatchRequest());

      const body = JSON.parse((fetchFn.mock.calls[0] as [string, RequestInit])[1].body as string) as Record<string, unknown>;
      expect(String(body['topic'])).toContain('portarium/my-tenant/robots/');
    });

    it('uses HiveMQ publish URL when flavour=hivemq', async () => {
      const fetchFn = okFetch();
      const gw = new MqttMissionGateway(
        { ...DEFAULT_CONFIG, flavour: 'hivemq' },
        fetchFn as typeof fetch,
      );

      await gw.dispatchMission(makeDispatchRequest());

      const [url] = fetchFn.mock.calls[0] as [string];
      expect(url).toContain('/api/v1/mqtt/publish');
    });
  });
});
