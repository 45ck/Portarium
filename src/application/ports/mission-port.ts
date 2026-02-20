import type { MissionActionRequestV1 } from '../../domain/robots/mission-action-semantics-v1.js';
import type { MissionStatus } from '../../domain/robots/mission-v1.js';
import type { CorrelationId, MissionId } from '../../domain/primitives/index.js';

export type MissionDispatchRequest = Readonly<{
  missionId: MissionId;
  correlationId: CorrelationId;
  planEffectIdempotencyKey: string;
  action: MissionActionRequestV1;
}>;

export type MissionDispatchDispatched = Readonly<{
  kind: 'Dispatched';
  missionId: MissionId;
  correlationId: CorrelationId;
  planEffectIdempotencyKey: string;
  gatewayRequestId: string;
  dispatchedAt: string;
}>;

export type MissionDispatchPolicyBlocked = Readonly<{
  kind: 'PolicyBlocked';
  missionId: MissionId;
  correlationId: CorrelationId;
  planEffectIdempotencyKey: string;
  policyReason: string;
}>;

export type MissionDispatchGatewayUnreachable = Readonly<{
  kind: 'GatewayUnreachable';
  missionId: MissionId;
  correlationId: CorrelationId;
  planEffectIdempotencyKey: string;
  message: string;
  retryAfterSeconds?: number;
}>;

export type MissionDispatchRejected = Readonly<{
  kind: 'Rejected';
  missionId: MissionId;
  correlationId: CorrelationId;
  planEffectIdempotencyKey: string;
  reason: 'InvalidMission' | 'UnsupportedAction' | 'InvalidState' | 'DuplicateRequest';
  message: string;
}>;

export type MissionDispatchResult =
  | MissionDispatchDispatched
  | MissionDispatchPolicyBlocked
  | MissionDispatchGatewayUnreachable
  | MissionDispatchRejected;

export type MissionCancelRequest = Readonly<{
  missionId: MissionId;
  correlationId: CorrelationId;
  planEffectIdempotencyKey: string;
  reason?: string;
}>;

export type MissionCancelResult = Readonly<{
  accepted: boolean;
  cancelledAt?: string;
  message?: string;
}>;

export type MissionStatusResult = Readonly<{
  missionId: MissionId;
  status: MissionStatus;
  actionExecutionId?: string;
  observedAt: string;
}>;

/**
 * MissionPort is the application boundary for robotics mission execution.
 * Semantics are defined in `.specify/specs/robotics-action-semantics.md`.
 */
export interface MissionPort {
  dispatchMission(request: MissionDispatchRequest): Promise<MissionDispatchResult>;
  cancelMission(request: MissionCancelRequest): Promise<MissionCancelResult>;
  getMissionStatus(
    missionId: MissionId,
    correlationId: CorrelationId,
  ): Promise<MissionStatusResult>;
}
