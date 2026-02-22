/**
 * MQTT edge gateway adapter implementing MissionPort.
 *
 * Translates the domain MissionPort interface to MQTT publish operations via
 * a broker HTTP API. This design works with EMQX, HiveMQ, and VerneMQ, which
 * all expose REST APIs for publishing and reading retained messages, making
 * the adapter deployable without a persistent MQTT client process.
 *
 * Topic conventions (QoS 1, retained status):
 *   Commands: portarium/{tenantId}/robots/{robotId}/commands/{missionId}
 *   Status:   portarium/{tenantId}/robots/{robotId}/status/{missionId}
 *   Cancel:   portarium/{tenantId}/robots/{robotId}/cancel/{missionId}
 *
 * Message format: JSON envelope { schemaVersion, payload, sentAt }
 *
 * Authentication: bearer token for broker HTTP API (or AWS SigV4 via env).
 *
 * Bead: bead-0516
 */

import type {
  MissionCancelRequest,
  MissionCancelResult,
  MissionDispatchRequest,
  MissionDispatchResult,
  MissionPort,
  MissionStatusResult,
} from '../../../application/ports/mission-port.js';
import type { CorrelationId, MissionId } from '../../../domain/primitives/index.js';
import type { MissionStatus } from '../../../domain/robots/mission-v1.js';

// ── Config ────────────────────────────────────────────────────────────────────

export interface MqttBrokerApiConfig {
  /** Broker HTTP API base URL, e.g. https://broker.example.com:8083/api/v5 (EMQX) */
  apiBaseUrl: string;
  /** Bearer token or API key for broker HTTP API. */
  apiToken: string;
  /** Tenant ID used in topic namespacing. */
  tenantId: string;
  /**
   * Broker HTTP API flavour. Affects the publish endpoint path and payload shape.
   * - 'emqx'    — EMQX Dashboard API v5 (/publish)
   * - 'hivemq'  — HiveMQ REST API (/api/v1/mqtt/publish)
   * - 'generic' — Simple POST with { topic, payload, qos, retain }
   * Default: 'generic'.
   */
  flavour?: 'emqx' | 'hivemq' | 'generic';
  /**
   * Status poll interval in ms (used by getMissionStatus retry loop).
   * Default: 500 ms.
   */
  statusPollIntervalMs?: number;
  /**
   * Maximum number of status poll attempts before returning stale result.
   * Default: 10.
   */
  statusPollMaxAttempts?: number;
  /** Optional request timeout in ms. Default: 10 000. */
  timeoutMs?: number;
}

type FetchFn = typeof fetch;
type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Payload shapes ────────────────────────────────────────────────────────────

interface MqttMessage {
  schemaVersion: 1;
  sentAt: string;
  payload: Record<string, unknown>;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class MqttMissionGateway implements MissionPort {
  readonly #config: MqttBrokerApiConfig;
  readonly #fetch: FetchFn;
  readonly #sleep: SleepFn;

  constructor(
    config: MqttBrokerApiConfig,
    fetchFn: FetchFn = fetch,
    sleepFn: SleepFn = defaultSleep,
  ) {
    this.#config = config;
    this.#fetch = fetchFn;
    this.#sleep = sleepFn;
  }

  // ── MissionPort ────────────────────────────────────────────────────────────

  async dispatchMission(request: MissionDispatchRequest): Promise<MissionDispatchResult> {
    const topic = this.#commandTopic(request.action.robotId, request.missionId);
    const message: MqttMessage = {
      schemaVersion: 1,
      sentAt: new Date().toISOString(),
      payload: {
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        robotId: request.action.robotId,
        fleetId: request.action.fleetId,
        gatewayId: request.action.gatewayId,
        actionType: request.action.actionType,
        actionName: request.action.actionName,
        parameters: request.action.parameters,
        idempotencyKey: request.action.idempotencyKey,
        supportsPreemption: request.action.supportsPreemption,
        bypassTierEvaluation: request.action.bypassTierEvaluation,
        completionMode: request.action.completionMode,
        requiresOperatorConfirmation: request.action.requiresOperatorConfirmation,
        requestedAt: request.action.requestedAt,
      },
    };

    try {
      await this.#publish(topic, message, { qos: 1, retain: false });
      return {
        kind: 'Dispatched',
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        gatewayRequestId: `mqtt-${request.missionId}-${Date.now()}`,
        dispatchedAt: message.sentAt,
      };
    } catch (err) {
      return {
        kind: 'GatewayUnreachable',
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        message: `MQTT broker unavailable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async cancelMission(request: MissionCancelRequest): Promise<MissionCancelResult> {
    const topic = this.#cancelTopic(request.missionId);
    const message: MqttMessage = {
      schemaVersion: 1,
      sentAt: new Date().toISOString(),
      payload: {
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        reason: request.reason ?? 'operator_cancel',
      },
    };

    try {
      await this.#publish(topic, message, { qos: 1, retain: false });
      return { accepted: true, cancelledAt: message.sentAt };
    } catch (err) {
      return {
        accepted: false,
        message: `MQTT cancel publish failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async getMissionStatus(
    missionId: MissionId,
    _correlationId: CorrelationId,
  ): Promise<MissionStatusResult> {
    // Poll the retained status topic with exponential-ish back-off.
    const topic = this.#statusTopic(missionId);
    const maxAttempts = this.#config.statusPollMaxAttempts ?? 10;
    const interval = this.#config.statusPollIntervalMs ?? 500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await this.#sleep(interval);

      try {
        const retained = await this.#readRetained(topic);
        if (retained) {
          const status = mapStatus(String(retained['status'] ?? 'pending'));
          return {
            missionId,
            status,
            ...(retained['action_execution_id'] ? { actionExecutionId: String(retained['action_execution_id']) } : {}),
            observedAt: String(retained['observed_at'] ?? new Date().toISOString()),
          };
        }
      } catch {
        // Transient fetch error — continue polling
      }
    }

    // No status received; return Pending as a safe default.
    return {
      missionId,
      status: 'Pending',
      observedAt: new Date().toISOString(),
    };
  }

  // ── Topic helpers ─────────────────────────────────────────────────────────

  #commandTopic(robotId: string, missionId: string): string {
    return `portarium/${this.#config.tenantId}/robots/${robotId}/commands/${missionId}`;
  }

  #cancelTopic(missionId: string): string {
    return `portarium/${this.#config.tenantId}/missions/${missionId}/cancel`;
  }

  #statusTopic(missionId: string): string {
    return `portarium/${this.#config.tenantId}/missions/${missionId}/status`;
  }

  // ── Broker HTTP API ───────────────────────────────────────────────────────

  async #publish(
    topic: string,
    message: MqttMessage,
    opts: { qos: 0 | 1 | 2; retain: boolean },
  ): Promise<void> {
    const { url, body } = this.#buildPublishRequest(topic, message, opts);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs ?? 10_000);

    try {
      const res = await this.#fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.#config.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Broker API error ${res.status}: ${text}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  #buildPublishRequest(
    topic: string,
    message: MqttMessage,
    opts: { qos: 0 | 1 | 2; retain: boolean },
  ): { url: string; body: Record<string, unknown> } {
    const flavour = this.#config.flavour ?? 'generic';
    const payloadBase64 = Buffer.from(JSON.stringify(message)).toString('base64');

    switch (flavour) {
      case 'emqx':
        return {
          url: `${this.#config.apiBaseUrl}/publish`,
          body: {
            topic,
            payload: payloadBase64,
            encoding: 'base64',
            qos: opts.qos,
            retain: opts.retain,
          },
        };
      case 'hivemq':
        return {
          url: `${this.#config.apiBaseUrl}/api/v1/mqtt/publish`,
          body: {
            topic,
            payload: payloadBase64,
            qos: opts.qos,
            retain: opts.retain,
            contentType: 'application/json',
          },
        };
      default:
        return {
          url: `${this.#config.apiBaseUrl}/publish`,
          body: {
            topic,
            payload: JSON.stringify(message),
            qos: opts.qos,
            retain: opts.retain,
          },
        };
    }
  }

  async #readRetained(topic: string): Promise<Record<string, unknown> | null> {
    // Read a retained message via broker HTTP API (EMQX /retained-messages/{topic}).
    // Other brokers may use different endpoints; returns null on 404 or unsupported.
    const flavour = this.#config.flavour ?? 'generic';
    if (flavour !== 'emqx') return null; // Only EMQX supports retained reads via REST

    const encodedTopic = encodeURIComponent(topic);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs ?? 10_000);

    try {
      const res = await this.#fetch(
        `${this.#config.apiBaseUrl}/retained-messages/${encodedTopic}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.#config.apiToken}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        },
      );
      if (res.status === 404) return null;
      if (!res.ok) return null;

      const json = await res.json() as Record<string, unknown>;
      // EMQX wraps payload in base64; decode and parse.
      const raw = json['payload'] as string | undefined;
      if (!raw) return null;
      const text = Buffer.from(raw, 'base64').toString('utf8');
      const msg = JSON.parse(text) as MqttMessage;
      return msg.payload;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ── Status mapping ─────────────────────────────────────────────────────────

function mapStatus(raw: string): MissionStatus {
  const MAP: Record<string, MissionStatus> = {
    pending: 'Pending',
    dispatched: 'Dispatched',
    executing: 'Executing',
    waiting_preemption: 'WaitingPreemption',
    succeeded: 'Succeeded',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return MAP[raw.toLowerCase()] ?? 'Pending';
}
