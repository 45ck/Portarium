/**
 * Off-platform approval domain model (bead-4emp).
 *
 * Defines the domain types for approvals that happen outside the main Cockpit
 * UI — in chat (Slack/Teams), mobile push notifications, email, or embedded
 * dashboard widgets.
 *
 * Core concepts:
 *   - `ApprovalCardProjectionV1` — a compact, channel-agnostic summary of an
 *     approval request containing only what an approver needs to decide.
 *   - `OffPlatformDecisionTokenV1` — a single-use, time-bounded token that
 *     binds an off-platform decision to a verified approver identity and the
 *     exact payload snapshot being approved.
 *   - `OffPlatformChannel` — discriminated union of supported delivery channels.
 *
 * Security invariants (non-negotiable):
 *   - Off-platform channels are convenience layers, never bypass paths.
 *   - Every decision token is bound to exactly one approver and one payload hash.
 *   - Tokens are single-use: consuming a token invalidates it.
 *   - SoD constraints are enforced regardless of channel (the token encodes
 *     which constraints apply; the application layer re-evaluates at decision time).
 *   - Identity verification is required: "anyone with the link" cannot approve.
 */

import type {
  ApprovalId as ApprovalIdType,
  HashSha256 as HashSha256Type,
  UserId as UserIdType,
  WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import type { Branded } from '../primitives/index.js';
import { brand } from '../primitives/index.js';
import type { ApprovalDecision } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Branded primitive: ApprovalTokenId
// ---------------------------------------------------------------------------

/** Unique identifier for a single-use off-platform decision token. */
export type ApprovalTokenId = Branded<string, 'ApprovalTokenId'>;

export const ApprovalTokenId = (value: string): ApprovalTokenId =>
  brand<string, 'ApprovalTokenId'>(value);

// ---------------------------------------------------------------------------
// Off-platform channel types
// ---------------------------------------------------------------------------

/** Supported off-platform delivery channels. */
export type OffPlatformChannelKind = 'slack' | 'teams' | 'email' | 'mobile_push' | 'webhook';

/** Channel-specific delivery metadata. */
export type OffPlatformChannelV1 =
  | Readonly<{
      kind: 'slack';
      /** Slack channel or DM identifier where the approval card was posted. */
      channelId: string;
      /** Slack message timestamp (ts) for the interactive message. */
      messageTs?: string;
    }>
  | Readonly<{
      kind: 'teams';
      /** Teams conversation ID where the adaptive card was posted. */
      conversationId: string;
      /** Activity ID of the posted card. */
      activityId?: string;
    }>
  | Readonly<{
      kind: 'email';
      /** Recipient email address (for audit trail, not for routing). */
      recipientEmail: string;
      /** Message-ID header of the sent email. */
      messageId?: string;
    }>
  | Readonly<{
      kind: 'mobile_push';
      /** Device token hash (not the actual token — privacy). */
      deviceTokenHash: string;
    }>
  | Readonly<{
      kind: 'webhook';
      /** Registered webhook endpoint identifier (not the URL — security). */
      webhookEndpointId: string;
    }>;

// ---------------------------------------------------------------------------
// Compact approval card projection
// ---------------------------------------------------------------------------

/**
 * A compact, channel-agnostic projection of an approval request.
 *
 * Contains exactly the information an approver needs to make a decision in a
 * constrained surface (chat message, push notification, email).  No mutable
 * state — this is a point-in-time snapshot.
 *
 * The `payloadHash` ensures the approver decides on exactly the version of
 * the payload that was projected, preventing TOCTOU issues.
 */
export type ApprovalCardProjectionV1 = Readonly<{
  schemaVersion: 1;
  approvalId: ApprovalIdType;
  workspaceId: WorkspaceIdType;
  /** Human-readable description of what is being approved. */
  prompt: string;
  /** Who requested this approval. */
  requestedByUserId: UserIdType;
  /** Content-addressable hash of the approval payload at projection time. */
  payloadHash: HashSha256Type;
  /** Risk level summary for quick triage. */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable risk explanation (one sentence). */
  riskSummary?: string;
  /** ISO-8601 deadline, if any. */
  dueAtIso?: string;
  /** Whether SoD constraints apply (approver should know before deciding). */
  hasSodConstraints: boolean;
  /** Short summary of SoD requirements (e.g., "Requires different approver from requestor"). */
  sodSummary?: string;
  /** Available actions for this approver on this channel. */
  availableActions: readonly OffPlatformAction[];
  /** ISO-8601 timestamp when this projection was created. */
  projectedAtIso: string;
}>;

/** Actions available on an off-platform approval card. */
export type OffPlatformAction = 'approve' | 'deny' | 'request_changes' | 'view_details';

// ---------------------------------------------------------------------------
// Off-platform decision token
// ---------------------------------------------------------------------------

/**
 * A single-use token that authorises an off-platform approval decision.
 *
 * The token binds:
 *   1. A specific approver identity (userId)
 *   2. A specific approval request (approvalId)
 *   3. A specific payload snapshot (payloadHash)
 *   4. A specific permitted action (or set of actions)
 *   5. A time window (expiresAtIso)
 *
 * Lifecycle:
 *   - Created when an approval card is projected to an off-platform channel.
 *   - Consumed when the approver acts (single-use; cannot be replayed).
 *   - Expires if not consumed within the time window.
 *   - Revoked if the approval is cancelled, reassigned, or the payload changes.
 *
 * The application layer is responsible for:
 *   - Generating cryptographically random token IDs.
 *   - Persisting token state (created → consumed | expired | revoked).
 *   - Re-evaluating SoD constraints at consumption time (not just at creation).
 */
export type OffPlatformDecisionTokenV1 = Readonly<{
  schemaVersion: 1;
  tokenId: ApprovalTokenId;
  approvalId: ApprovalIdType;
  workspaceId: WorkspaceIdType;
  /** The user this token was issued to. Only this user may consume it. */
  issuedToUserId: UserIdType;
  /** The payload hash at token creation time. Decision is void if payload changed. */
  boundPayloadHash: HashSha256Type;
  /** Which actions this token permits. */
  permittedActions: readonly OffPlatformAction[];
  /** Which channel this token was delivered through. */
  channel: OffPlatformChannelV1;
  /** ISO-8601 creation timestamp. */
  issuedAtIso: string;
  /** ISO-8601 expiry timestamp. Token cannot be consumed after this time. */
  expiresAtIso: string;
  /** Current lifecycle state. */
  status: OffPlatformTokenStatus;
}>;

export type OffPlatformTokenStatus = 'active' | 'consumed' | 'expired' | 'revoked';

// ---------------------------------------------------------------------------
// Token consumption result
// ---------------------------------------------------------------------------

/**
 * Result of attempting to consume an off-platform decision token.
 *
 * The consuming code (application layer) calls `validateTokenConsumption()`
 * to check whether a token can be consumed, then records the decision
 * through the normal approval pipeline.
 */
export type TokenConsumptionResultV1 =
  | Readonly<{
      ok: true;
      /** The validated decision details, ready for the approval pipeline. */
      decision: ValidatedOffPlatformDecisionV1;
    }>
  | Readonly<{
      ok: false;
      /** Why the token could not be consumed. */
      reason: TokenRejectionReason;
      /** Human-readable explanation for the approver. */
      message: string;
    }>;

export type TokenRejectionReason =
  | 'token_expired'
  | 'token_already_consumed'
  | 'token_revoked'
  | 'payload_changed'
  | 'action_not_permitted'
  | 'identity_mismatch'
  | 'sod_violation';

/**
 * A validated off-platform decision, ready to be fed into the approval pipeline.
 *
 * At this point, all token-level checks have passed. The application layer
 * should still run SoD evaluation before recording the decision.
 */
export type ValidatedOffPlatformDecisionV1 = Readonly<{
  tokenId: ApprovalTokenId;
  approvalId: ApprovalIdType;
  workspaceId: WorkspaceIdType;
  decidedByUserId: UserIdType;
  decision: ApprovalDecision;
  /** Optional rationale (required for Denied/RequestChanges in some policies). */
  rationale?: string;
  /** The channel through which the decision was made. */
  channel: OffPlatformChannelV1;
  /** ISO-8601 timestamp of the decision. */
  decidedAtIso: string;
  /** The payload hash that was bound to the token at decision time. */
  boundPayloadHash: HashSha256Type;
}>;

// ---------------------------------------------------------------------------
// Token validation (pure domain logic)
// ---------------------------------------------------------------------------

export class OffPlatformTokenError extends Error {
  public override readonly name = 'OffPlatformTokenError';

  public constructor(message: string) {
    super(message);
  }
}

/**
 * Validate whether a decision token can be consumed.
 *
 * This is a pure domain function — no I/O, no side effects. The application
 * layer calls this before recording the decision.
 *
 * @param token   The token to validate.
 * @param params  The consumption attempt parameters.
 * @returns       A `TokenConsumptionResultV1` indicating success or failure.
 */
export function validateTokenConsumption(
  token: OffPlatformDecisionTokenV1,
  params: {
    attemptedByUserId: UserIdType;
    attemptedAction: ApprovalDecision;
    currentPayloadHash: HashSha256Type;
    nowIso: string;
    rationale?: string;
  },
): TokenConsumptionResultV1 {
  // 1. Token must be active
  if (token.status === 'consumed') {
    return {
      ok: false,
      reason: 'token_already_consumed',
      message: 'This decision link has already been used.',
    };
  }
  if (token.status === 'revoked') {
    return { ok: false, reason: 'token_revoked', message: 'This decision link has been revoked.' };
  }
  if (token.status === 'expired') {
    return { ok: false, reason: 'token_expired', message: 'This decision link has expired.' };
  }

  // 2. Check time-based expiry (even if status not yet updated)
  if (params.nowIso >= token.expiresAtIso) {
    return { ok: false, reason: 'token_expired', message: 'This decision link has expired.' };
  }

  // 3. Identity must match
  if (params.attemptedByUserId !== token.issuedToUserId) {
    return {
      ok: false,
      reason: 'identity_mismatch',
      message: 'This decision link was issued to a different user.',
    };
  }

  // 4. Action must be permitted
  const actionToOffPlatform = mapDecisionToAction(params.attemptedAction);
  if (!token.permittedActions.includes(actionToOffPlatform)) {
    return {
      ok: false,
      reason: 'action_not_permitted',
      message: `Action "${params.attemptedAction}" is not permitted by this decision link.`,
    };
  }

  // 5. Payload must not have changed (TOCTOU protection)
  if (params.currentPayloadHash !== token.boundPayloadHash) {
    return {
      ok: false,
      reason: 'payload_changed',
      message:
        'The approval content has changed since this link was generated. Please review the updated version.',
    };
  }

  // All checks passed
  return {
    ok: true,
    decision: {
      tokenId: token.tokenId,
      approvalId: token.approvalId,
      workspaceId: token.workspaceId,
      decidedByUserId: params.attemptedByUserId,
      decision: params.attemptedAction,
      channel: token.channel,
      decidedAtIso: params.nowIso,
      boundPayloadHash: token.boundPayloadHash,
      ...(params.rationale !== undefined ? { rationale: params.rationale } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Projection builder
// ---------------------------------------------------------------------------

/**
 * Build a compact approval card projection from an approval and its context.
 *
 * This is a pure domain function that produces the channel-agnostic card data.
 * The presentation/infrastructure layer is responsible for rendering it into
 * channel-specific formats (Slack blocks, Teams adaptive cards, email HTML).
 */
export function buildApprovalCardProjection(params: {
  approvalId: ApprovalIdType;
  workspaceId: WorkspaceIdType;
  prompt: string;
  requestedByUserId: UserIdType;
  payloadHash: HashSha256Type;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskSummary?: string;
  dueAtIso?: string;
  hasSodConstraints: boolean;
  sodSummary?: string;
  availableActions: readonly OffPlatformAction[];
  nowIso: string;
}): ApprovalCardProjectionV1 {
  const {
    approvalId,
    workspaceId,
    prompt,
    requestedByUserId,
    payloadHash,
    riskLevel,
    riskSummary,
    dueAtIso,
    hasSodConstraints,
    sodSummary,
    availableActions,
    nowIso,
  } = params;

  if (availableActions.length === 0) {
    throw new OffPlatformTokenError('availableActions must not be empty.');
  }

  const projection: ApprovalCardProjectionV1 = {
    schemaVersion: 1,
    approvalId,
    workspaceId,
    prompt,
    requestedByUserId,
    payloadHash,
    riskLevel,
    hasSodConstraints,
    availableActions,
    projectedAtIso: nowIso,
    ...(riskSummary !== undefined ? { riskSummary } : {}),
    ...(dueAtIso !== undefined ? { dueAtIso } : {}),
    ...(sodSummary !== undefined ? { sodSummary } : {}),
  };

  return deepFreeze(projection);
}

// ---------------------------------------------------------------------------
// Channel kind guard
// ---------------------------------------------------------------------------

const VALID_CHANNEL_KINDS = new Set<string>(['slack', 'teams', 'email', 'mobile_push', 'webhook']);

export function isOffPlatformChannelKind(value: string): value is OffPlatformChannelKind {
  return VALID_CHANNEL_KINDS.has(value);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapDecisionToAction(decision: ApprovalDecision): OffPlatformAction {
  switch (decision) {
    case 'Approved':
      return 'approve';
    case 'Denied':
      return 'deny';
    case 'RequestChanges':
      return 'request_changes';
  }
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const child = (obj as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return obj;
}
