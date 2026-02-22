/**
 * gRPC edge gateway adapter implementing MissionPort.
 *
 * Translates the domain MissionPort interface to gRPC calls over the
 * `portarium.robotics.v1.MissionService` service defined in mission.proto.
 *
 * Uses @grpc/grpc-js + @grpc/proto-loader to dynamically load the proto at
 * runtime, which avoids a code-generation build step and keeps this a
 * self-contained prototype.
 *
 * Connection model:
 *   - One gRPC channel per gateway endpoint (created lazily on first call).
 *   - TLS via provided credentials (mTLS or server-only).
 *   - Deadline applied per call (configurable, default 10 s).
 *
 * Bead: bead-0515
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as path from 'path';
import type {
  MissionCancelRequest,
  MissionCancelResult,
  MissionDispatchRequest,
  MissionDispatchResult,
  MissionPort,
  MissionStatusResult,
} from '../../../application/ports/mission-port.js';
import type { CorrelationId, MissionId } from '../../../domain/primitives/index.js';

// ── Dynamic gRPC imports (avoid type-only import to keep grpc-js optional) ───

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const grpc = require('@grpc/grpc-js') as typeof import('@grpc/grpc-js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const protoLoader = require('@grpc/proto-loader') as typeof import('@grpc/proto-loader');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, 'proto', 'mission.proto');

// ── Config ────────────────────────────────────────────────────────────────────

export interface GrpcMissionGatewayConfig {
  /** gRPC endpoint, e.g. "edge-gateway.robot-site.local:50051" */
  endpoint: string;
  /**
   * gRPC channel credentials.
   * Pass `grpc.credentials.createInsecure()` for dev/test.
   * Pass `grpc.credentials.createSsl(...)` or mTLS creds for production.
   * If omitted, insecure credentials are used (for local prototype use only).
   */
  credentials?: import('@grpc/grpc-js').ChannelCredentials;
  /** Per-call deadline in ms. Default: 10 000. */
  deadlineMs?: number;
}

// ── Internal gRPC client types ────────────────────────────────────────────────

type GrpcCallback<T> = (err: Error | null, response: T) => void;

interface MissionServiceClient {
  DispatchMission(req: unknown, deadline: { deadline: Date }, cb: GrpcCallback<unknown>): void;
  CancelMission(req: unknown, deadline: { deadline: Date }, cb: GrpcCallback<unknown>): void;
  GetMissionStatus(req: unknown, deadline: { deadline: Date }, cb: GrpcCallback<unknown>): void;
  close(): void;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class GrpcMissionGateway implements MissionPort {
  readonly #config: GrpcMissionGatewayConfig;
  #client: MissionServiceClient | null = null;

  constructor(config: GrpcMissionGatewayConfig) {
    this.#config = config;
  }

  /** Lazily create and cache the gRPC client. */
  #getClient(): MissionServiceClient {
    if (this.#client) return this.#client;

    const packageDef = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const pkg = grpc.loadPackageDefinition(packageDef) as Record<string, unknown>;
    const portarium = pkg['portarium'] as Record<string, unknown>;
    const robotics = portarium['robotics'] as Record<string, unknown>;
    const v1 = robotics['v1'] as Record<string, unknown>;
    const MissionServiceCtor = v1['MissionService'] as new (
      endpoint: string,
      creds: import('@grpc/grpc-js').ChannelCredentials,
    ) => MissionServiceClient;

    const creds = this.#config.credentials ?? grpc.credentials.createInsecure();
    this.#client = new MissionServiceCtor(this.#config.endpoint, creds);
    return this.#client;
  }

  /** Wrap a gRPC callback-style call in a Promise with deadline. */
  #call<TReq, TRes>(
    method: (
      client: MissionServiceClient,
    ) => (req: TReq, opts: { deadline: Date }, cb: GrpcCallback<TRes>) => void,
    request: TReq,
  ): Promise<TRes> {
    return new Promise((resolve, reject) => {
      const client = this.#getClient();
      const deadline = new Date(Date.now() + (this.#config.deadlineMs ?? 10_000));
      (method(client) as (req: unknown, opts: { deadline: Date }, cb: GrpcCallback<TRes>) => void)(
        request,
        { deadline },
        (err, res) => {
          if (err) reject(err);
          else resolve(res as TRes);
        },
      );
    });
  }

  // ── MissionPort ────────────────────────────────────────────────────────────

  async dispatchMission(request: MissionDispatchRequest): Promise<MissionDispatchResult> {
    const grpcReq = {
      mission_id: request.missionId,
      correlation_id: request.correlationId,
      plan_effect_idempotency_key: request.planEffectIdempotencyKey,
      robot_id: request.action.robotId,
      fleet_id: request.action.fleetId ?? '',
      action_type: request.action.actionType,
      action_name: request.action.actionName,
      parameters: { fields: flattenParameters(request.action.parameters) },
      idempotency_key: request.action.idempotencyKey ?? '',
      supports_preemption: request.action.supportsPreemption,
      bypass_tier_evaluation: request.action.bypassTierEvaluation,
      completion_mode: request.action.completionMode,
      requires_operator_confirmation: request.action.requiresOperatorConfirmation,
      requested_at: request.action.requestedAt,
    };

    let res: Record<string, unknown>;
    try {
      res = await this.#call<typeof grpcReq, Record<string, unknown>>(
        (c) => c.DispatchMission.bind(c) as never,
        grpcReq,
      );
    } catch (err) {
      return {
        kind: 'GatewayUnreachable',
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        message: err instanceof Error ? err.message : String(err),
      };
    }

    const status = String(res['status'] ?? '');
    switch (status) {
      case 'DISPATCH_STATUS_DISPATCHED':
        return {
          kind: 'Dispatched',
          missionId: request.missionId,
          correlationId: request.correlationId,
          planEffectIdempotencyKey: request.planEffectIdempotencyKey,
          gatewayRequestId: String(res['gateway_request_id'] ?? ''),
          dispatchedAt: String(res['dispatched_at'] ?? new Date().toISOString()),
        };
      case 'DISPATCH_STATUS_POLICY_BLOCKED':
        return {
          kind: 'PolicyBlocked',
          missionId: request.missionId,
          correlationId: request.correlationId,
          planEffectIdempotencyKey: request.planEffectIdempotencyKey,
          policyReason: String(res['policy_reason'] ?? ''),
        };
      case 'DISPATCH_STATUS_REJECTED':
        return {
          kind: 'Rejected',
          missionId: request.missionId,
          correlationId: request.correlationId,
          planEffectIdempotencyKey: request.planEffectIdempotencyKey,
          reason: mapRejectReason(String(res['reject_reason'] ?? '')),
          message: String(res['message'] ?? ''),
        };
      default:
        return {
          kind: 'GatewayUnreachable',
          missionId: request.missionId,
          correlationId: request.correlationId,
          planEffectIdempotencyKey: request.planEffectIdempotencyKey,
          message: `Unexpected dispatch status from gateway: ${status}`,
        };
    }
  }

  async cancelMission(request: MissionCancelRequest): Promise<MissionCancelResult> {
    const grpcReq = {
      mission_id: request.missionId,
      correlation_id: request.correlationId,
      plan_effect_idempotency_key: request.planEffectIdempotencyKey,
      reason: request.reason ?? '',
    };

    try {
      const res = await this.#call<typeof grpcReq, Record<string, unknown>>(
        (c) => c.CancelMission.bind(c) as never,
        grpcReq,
      );
      return {
        accepted: Boolean(res['accepted']),
        ...(res['cancelled_at'] ? { cancelledAt: String(res['cancelled_at']) } : {}),
        ...(res['message'] ? { message: String(res['message']) } : {}),
      };
    } catch (err) {
      return {
        accepted: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getMissionStatus(
    missionId: MissionId,
    correlationId: CorrelationId,
  ): Promise<MissionStatusResult> {
    const grpcReq = { mission_id: missionId, correlation_id: correlationId };

    const res = await this.#call<typeof grpcReq, Record<string, unknown>>(
      (c) => c.GetMissionStatus.bind(c) as never,
      grpcReq,
    );

    return {
      missionId,
      status: mapMissionStatus(String(res['status'] ?? 'unknown')),
      ...(res['action_execution_id']
        ? { actionExecutionId: String(res['action_execution_id']) }
        : {}),
      observedAt: String(res['observed_at'] ?? new Date().toISOString()),
    };
  }

  /** Release the gRPC channel. Call when the adapter is no longer needed. */
  close(): void {
    this.#client?.close();
    this.#client = null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenParameters(params: Readonly<Record<string, unknown>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    result[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return result;
}

function mapRejectReason(
  raw: string,
): 'InvalidMission' | 'UnsupportedAction' | 'InvalidState' | 'DuplicateRequest' {
  switch (raw) {
    case 'InvalidMission':
      return 'InvalidMission';
    case 'UnsupportedAction':
      return 'UnsupportedAction';
    case 'InvalidState':
      return 'InvalidState';
    case 'DuplicateRequest':
      return 'DuplicateRequest';
    default:
      return 'InvalidMission';
  }
}

function mapMissionStatus(
  raw: string,
): import('../../../domain/robots/mission-v1.js').MissionStatus {
  const MAP: Record<string, import('../../../domain/robots/mission-v1.js').MissionStatus> = {
    pending: 'Pending',
    dispatched: 'Dispatched',
    executing: 'Executing',
    waitingpreemption: 'WaitingPreemption',
    in_progress: 'Executing',
    succeeded: 'Succeeded',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return MAP[raw.toLowerCase()] ?? 'Pending';
}
