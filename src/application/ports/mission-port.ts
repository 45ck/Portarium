import type {
  MissionActionRequestV1,
  MissionManualCompletionSignalV1,
} from '../../domain/robots/mission-action-semantics-v1.js';

export type MissionDispatchAccepted = Readonly<{
  accepted: true;
  missionId: MissionActionRequestV1['missionId'];
  actionExecutionId: string;
  deduplicated: boolean;
  acceptedAt: string;
}>;

export type MissionDispatchRejected = Readonly<{
  accepted: false;
  reason:
    | 'PolicyDenied'
    | 'SafetyBoundaryDenied'
    | 'UnsupportedAction'
    | 'InvalidState'
    | 'DuplicateWithoutIdempotency';
  message: string;
}>;

export type MissionDispatchResult = MissionDispatchAccepted | MissionDispatchRejected;

export type MissionPreemptionRequest = Readonly<{
  missionId: MissionActionRequestV1['missionId'];
  actionExecutionId: string;
  requestedAt: string;
  reason?: string;
}>;

export type MissionPreemptionResult = Readonly<{
  requested: boolean;
  actionExecutionId: string;
  acknowledgedAt?: string;
}>;

/**
 * MissionPort is the application boundary for robotics mission execution.
 * Semantics are defined in `.specify/specs/robotics-action-semantics.md`.
 */
export interface MissionPort {
  dispatchAction(request: MissionActionRequestV1): Promise<MissionDispatchResult>;
  requestPreemption(request: MissionPreemptionRequest): Promise<MissionPreemptionResult>;
  confirmManualCompletion(signal: MissionManualCompletionSignalV1): Promise<void>;
}
