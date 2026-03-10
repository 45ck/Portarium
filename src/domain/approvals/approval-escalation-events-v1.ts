/**
 * Domain event payload types for approval escalation and expiry (bead-0910).
 *
 * These are pure data shapes — no side effects, no external deps.
 */

import type { ApprovalId as ApprovalIdType, UserId as UserIdType } from '../primitives/index.js';

/** Payload emitted when an approval escalates to a new step. */
export type ApprovalEscalatedPayload = Readonly<{
  approvalId: ApprovalIdType;
  stepIndex: number;
  escalateToUserId: UserIdType;
  elapsedHours: number;
}>;

/** Payload emitted when an approval expires past its final deadline. */
export type ApprovalExpiredPayload = Readonly<{
  approvalId: ApprovalIdType;
  reason: string;
  expiredAtIso: string;
}>;
