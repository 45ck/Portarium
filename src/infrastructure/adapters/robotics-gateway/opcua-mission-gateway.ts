/**
 * OPC UA Mission Gateway — implements MissionPort via OPC UA method calls.
 *
 * Uses the node-opcua client library to invoke OPC UA Methods on a PLC or
 * industrial robot controller. Each MissionPort operation maps to one OPC UA
 * MethodCall on the configured server.
 *
 * Node addressing convention (configurable):
 *   DispatchMission → ns=<ns>;s=<objectPath>/DispatchMission
 *   CancelMission   → ns=<ns>;s=<objectPath>/CancelMission
 *   GetStatus       → ns=<ns>;s=<objectPath>/GetMissionStatus
 *
 * The gateway creates a new OPC UA session per request (stateless prototype).
 * A production implementation should pool sessions.
 *
 * Supported node-opcua version: >=2.x (node-opcua@2 CommonJS API).
 *
 * Bead: bead-0518
 */

import { createRequire } from 'module';
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

const require = createRequire(import.meta.url);

// ── Config ────────────────────────────────────────────────────────────────────

export interface OpcUaMissionGatewayConfig {
  /** OPC UA endpoint URL, e.g. opc.tcp://plc.local:4840 */
  endpointUrl: string;
  /** OPC UA namespace index for method nodes. Default: 1. */
  namespaceIndex?: number;
  /** Browse path prefix to the Mission object node. Default: "Portarium.Mission". */
  objectPath?: string;
  /** Session timeout in ms. Default: 10 000. */
  sessionTimeoutMs?: number;
  /** Security mode: None | Sign | SignAndEncrypt. Default: "None". */
  securityMode?: string;
  /** Security policy URI. Default: "None". */
  securityPolicy?: string;
}

// ── OPC UA status code constants ──────────────────────────────────────────────

/** OPC UA StatusCode "Good" value. */
const OPC_STATUS_GOOD = 0x00000000;

// ── Mission result code convention ───────────────────────────────────────────

/** Maps an OPC UA method output "resultCode" string to MissionStatus. */
function resultCodeToStatus(code: string | undefined): MissionStatus {
  switch ((code ?? '').toUpperCase()) {
    case 'DISPATCHED':
      return 'Dispatched';
    case 'EXECUTING':
      return 'Executing';
    case 'SUCCEEDED':
    case 'SUCCESS':
      return 'Succeeded';
    case 'CANCELLED':
    case 'CANCELED':
      return 'Cancelled';
    case 'FAILED':
    case 'ERROR':
    default:
      return 'Failed';
  }
}

/** Factory for creating an OPC UA client (injectable for testing). */
export type OpcUaClientFactory = (config: OpcUaMissionGatewayConfig) => Promise<{
  client: OpcUaClientLike;
  session: OpcUaSessionLike;
  cleanup: () => Promise<void>;
}>;

// ── Adapter ───────────────────────────────────────────────────────────────────

export class OpcUaMissionGateway implements MissionPort {
  readonly #config: OpcUaMissionGatewayConfig;
  readonly #clientFactory: OpcUaClientFactory;

  constructor(config: OpcUaMissionGatewayConfig, clientFactory?: OpcUaClientFactory) {
    this.#config = config;
    this.#clientFactory = clientFactory ?? ((cfg) => this.#openSessionInternal(cfg));
  }

  async dispatchMission(request: MissionDispatchRequest): Promise<MissionDispatchResult> {
    let opened: { client: OpcUaClientLike; session: OpcUaSessionLike; cleanup: () => Promise<void> };
    try {
      opened = await this.#clientFactory(this.#config);
    } catch (err) {
      return {
        kind: 'GatewayUnreachable',
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        message: `OPC UA connect error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const { client, session, cleanup } = opened;
    try {
      const ns = this.#config.namespaceIndex ?? 1;
      const obj = this.#config.objectPath ?? 'Portarium.Mission';

      const methodNodeId = `ns=${ns};s=${obj}/DispatchMission`;
      const objectNodeId = `ns=${ns};s=${obj}`;

      // Input arguments: missionId (String), actionName (String), paramsJson (String)
      const inputArgs = [
        { dataType: client.DataType?.['String'] ?? 12, value: String(request.missionId) },
        { dataType: client.DataType?.['String'] ?? 12, value: request.action.actionName },
        { dataType: client.DataType?.['String'] ?? 12, value: JSON.stringify(request.action.parameters) },
      ];

      const result = (await session.call({
        objectId: objectNodeId,
        methodId: methodNodeId,
        inputArguments: inputArgs,
      })) as OpcUaCallResult;

      if (!isGoodStatus(result.statusCode)) {
        return {
          kind: 'GatewayUnreachable',
          missionId: request.missionId,
          correlationId: request.correlationId,
          planEffectIdempotencyKey: request.planEffectIdempotencyKey,
          message: `OPC UA DispatchMission failed: status=0x${(result.statusCode ?? 0).toString(16)}`,
        };
      }

      const gatewayRequestId = String(result.outputArguments?.[0]?.value ?? request.missionId);
      return {
        kind: 'Dispatched',
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        gatewayRequestId,
        dispatchedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        kind: 'GatewayUnreachable',
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        message: `OPC UA call error: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      await cleanup();
    }
  }

  async cancelMission(request: MissionCancelRequest): Promise<MissionCancelResult> {
    let cleanup: (() => Promise<void>) | undefined;

    try {
      const opened = await this.#clientFactory(this.#config);
      cleanup = opened.cleanup;
      const { client, session } = opened;

      const ns = this.#config.namespaceIndex ?? 1;
      const obj = this.#config.objectPath ?? 'Portarium.Mission';

      const result = (await session.call({
        objectId: `ns=${ns};s=${obj}`,
        methodId: `ns=${ns};s=${obj}/CancelMission`,
        inputArguments: [
          { dataType: client.DataType?.['String'] ?? 12, value: String(request.missionId) },
          ...(request.reason !== undefined
            ? [{ dataType: client.DataType?.['String'] ?? 12, value: request.reason }]
            : []),
        ],
      })) as OpcUaCallResult;

      if (!isGoodStatus(result.statusCode)) {
        return {
          accepted: false,
          message: `OPC UA CancelMission failed: status=0x${(result.statusCode ?? 0).toString(16)}`,
        };
      }

      return { accepted: true, cancelledAt: new Date().toISOString() };
    } catch (err) {
      return {
        accepted: false,
        message: `OPC UA cancel error: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      await cleanup?.();
    }
  }

  async getMissionStatus(missionId: MissionId, _correlationId: CorrelationId): Promise<MissionStatusResult> {
    let cleanup: (() => Promise<void>) | undefined;

    try {
      const opened = await this.#clientFactory(this.#config);
      cleanup = opened.cleanup;
      const { client, session } = opened;

      const ns = this.#config.namespaceIndex ?? 1;
      const obj = this.#config.objectPath ?? 'Portarium.Mission';

      const result = (await session.call({
        objectId: `ns=${ns};s=${obj}`,
        methodId: `ns=${ns};s=${obj}/GetMissionStatus`,
        inputArguments: [
          { dataType: client.DataType?.['String'] ?? 12, value: String(missionId) },
        ],
      })) as OpcUaCallResult;

      if (!isGoodStatus(result.statusCode)) {
        return { missionId, status: 'Failed', observedAt: new Date().toISOString() };
      }

      const statusCode = String(result.outputArguments?.[0]?.value ?? '');
      const actionExecutionId = result.outputArguments?.[1]?.value as string | undefined;

      return {
        missionId,
        status: resultCodeToStatus(statusCode),
        ...(actionExecutionId !== undefined ? { actionExecutionId } : {}),
        observedAt: new Date().toISOString(),
      };
    } catch {
      return { missionId, status: 'Failed', observedAt: new Date().toISOString() };
    } finally {
      await cleanup?.();
    }
  }

  // ── OPC UA session helpers ────────────────────────────────────────────────

  async #openSessionInternal(cfg: OpcUaMissionGatewayConfig): Promise<{ client: OpcUaClientLike; session: OpcUaSessionLike; cleanup: () => Promise<void> }> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const opcua = require('node-opcua') as any;

    const client: OpcUaClientLike = opcua.OPCUAClient.create({
      endpointMustExist: false,
      securityMode: opcua.MessageSecurityMode?.[cfg.securityMode ?? 'None'] ?? 1,
      securityPolicy: opcua.SecurityPolicy?.[cfg.securityPolicy ?? 'None'] ?? 'http://opcfoundation.org/UA/SecurityPolicy#None',
      connectionStrategy: {
        maxRetry: 0,
        initialDelay: 100,
        maxDelay: 500,
      },
      requestedSessionTimeout: cfg.sessionTimeoutMs ?? 10_000,
    });

    await client.connect(cfg.endpointUrl);
    const session: OpcUaSessionLike = await client.createSession();

    const cleanup = async () => {
      try { await session.close(); } catch { /* ignore */ }
      try { await client.disconnect(); } catch { /* ignore */ }
    };

    return { client, session, cleanup };
  }
}

// ── Internal type shims ────────────────────────────────────────────────────────

interface OpcUaCallResult {
  statusCode?: number;
  outputArguments?: Array<{ value: unknown }>;
}

interface OpcUaClientLike {
  DataType?: Record<string, number>;
  connect(url: string): Promise<void>;
  createSession(): Promise<OpcUaSessionLike>;
  disconnect(): Promise<void>;
}

interface OpcUaSessionLike {
  call(request: {
    objectId: string;
    methodId: string;
    inputArguments: Array<{ dataType: number; value: unknown }>;
  }): Promise<OpcUaCallResult>;
  close(): Promise<void>;
}

function isGoodStatus(code: number | undefined): boolean {
  return (code ?? OPC_STATUS_GOOD) === OPC_STATUS_GOOD;
}
