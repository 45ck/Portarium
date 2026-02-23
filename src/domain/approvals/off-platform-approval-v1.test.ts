import { describe, expect, it } from 'vitest';

import {
  ApprovalTokenId,
  buildApprovalCardProjection,
  isOffPlatformChannelKind,
  validateTokenConsumption,
  type OffPlatformChannelV1,
  type OffPlatformDecisionTokenV1,
} from './off-platform-approval-v1.js';
import { ApprovalId, HashSha256, UserId, WorkspaceId } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const APPROVAL_ID = ApprovalId('appr-off-1');
const WORKSPACE_ID = WorkspaceId('ws-1');
const USER_ALICE = UserId('usr-alice');
const USER_BOB = UserId('usr-bob');
const PAYLOAD_HASH = HashSha256('sha256-payload-abc');
const TOKEN_ID = ApprovalTokenId('tok-123');
const NOW = '2026-02-23T12:00:00Z';
const EXPIRES = '2026-02-23T13:00:00Z';

function makeSlackChannel(): OffPlatformChannelV1 {
  return { kind: 'slack', channelId: 'C12345', messageTs: '1234567890.123456' };
}

function makeActiveToken(
  overrides?: Partial<OffPlatformDecisionTokenV1>,
): OffPlatformDecisionTokenV1 {
  return {
    schemaVersion: 1,
    tokenId: TOKEN_ID,
    approvalId: APPROVAL_ID,
    workspaceId: WORKSPACE_ID,
    issuedToUserId: USER_BOB,
    boundPayloadHash: PAYLOAD_HASH,
    permittedActions: ['approve', 'deny', 'request_changes'],
    channel: makeSlackChannel(),
    issuedAtIso: '2026-02-23T11:00:00Z',
    expiresAtIso: EXPIRES,
    status: 'active',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildApprovalCardProjection
// ---------------------------------------------------------------------------

describe('buildApprovalCardProjection', () => {
  it('creates a frozen projection with all required fields', () => {
    const projection = buildApprovalCardProjection({
      approvalId: APPROVAL_ID,
      workspaceId: WORKSPACE_ID,
      prompt: 'Deploy to production',
      requestedByUserId: USER_ALICE,
      payloadHash: PAYLOAD_HASH,
      riskLevel: 'high',
      hasSodConstraints: true,
      availableActions: ['approve', 'deny', 'view_details'],
      nowIso: NOW,
    });

    expect(projection.schemaVersion).toBe(1);
    expect(projection.approvalId).toBe(APPROVAL_ID);
    expect(projection.prompt).toBe('Deploy to production');
    expect(projection.requestedByUserId).toBe(USER_ALICE);
    expect(projection.payloadHash).toBe(PAYLOAD_HASH);
    expect(projection.riskLevel).toBe('high');
    expect(projection.hasSodConstraints).toBe(true);
    expect(projection.availableActions).toContain('approve');
    expect(projection.projectedAtIso).toBe(NOW);
    expect(Object.isFrozen(projection)).toBe(true);
  });

  it('includes optional fields when provided', () => {
    const projection = buildApprovalCardProjection({
      approvalId: APPROVAL_ID,
      workspaceId: WORKSPACE_ID,
      prompt: 'Update records',
      requestedByUserId: USER_ALICE,
      payloadHash: PAYLOAD_HASH,
      riskLevel: 'medium',
      riskSummary: 'Affects 50 records in Salesforce',
      dueAtIso: '2026-02-24T00:00:00Z',
      hasSodConstraints: true,
      sodSummary: 'Requires different approver from requestor',
      availableActions: ['approve', 'deny'],
      nowIso: NOW,
    });

    expect(projection.riskSummary).toBe('Affects 50 records in Salesforce');
    expect(projection.dueAtIso).toBe('2026-02-24T00:00:00Z');
    expect(projection.sodSummary).toBe('Requires different approver from requestor');
  });

  it('omits optional fields when not provided', () => {
    const projection = buildApprovalCardProjection({
      approvalId: APPROVAL_ID,
      workspaceId: WORKSPACE_ID,
      prompt: 'Simple change',
      requestedByUserId: USER_ALICE,
      payloadHash: PAYLOAD_HASH,
      riskLevel: 'low',
      hasSodConstraints: false,
      availableActions: ['approve'],
      nowIso: NOW,
    });

    expect('riskSummary' in projection).toBe(false);
    expect('dueAtIso' in projection).toBe(false);
    expect('sodSummary' in projection).toBe(false);
  });

  it('throws when availableActions is empty', () => {
    expect(() =>
      buildApprovalCardProjection({
        approvalId: APPROVAL_ID,
        workspaceId: WORKSPACE_ID,
        prompt: 'Test',
        requestedByUserId: USER_ALICE,
        payloadHash: PAYLOAD_HASH,
        riskLevel: 'low',
        hasSodConstraints: false,
        availableActions: [],
        nowIso: NOW,
      }),
    ).toThrow(/availableActions/);
  });

  it('deep-freezes nested arrays', () => {
    const projection = buildApprovalCardProjection({
      approvalId: APPROVAL_ID,
      workspaceId: WORKSPACE_ID,
      prompt: 'Test',
      requestedByUserId: USER_ALICE,
      payloadHash: PAYLOAD_HASH,
      riskLevel: 'low',
      hasSodConstraints: false,
      availableActions: ['approve', 'deny'],
      nowIso: NOW,
    });

    expect(Object.isFrozen(projection.availableActions)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateTokenConsumption — success
// ---------------------------------------------------------------------------

describe('validateTokenConsumption — success', () => {
  it('succeeds for a valid active token with matching identity and payload', () => {
    const token = makeActiveToken();
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.tokenId).toBe(TOKEN_ID);
      expect(result.decision.approvalId).toBe(APPROVAL_ID);
      expect(result.decision.decidedByUserId).toBe(USER_BOB);
      expect(result.decision.decision).toBe('Approved');
      expect(result.decision.decidedAtIso).toBe(NOW);
      expect(result.decision.boundPayloadHash).toBe(PAYLOAD_HASH);
    }
  });

  it('includes rationale when provided', () => {
    const token = makeActiveToken();
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Denied',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
      rationale: 'Insufficient evidence',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.rationale).toBe('Insufficient evidence');
    }
  });

  it('omits rationale when not provided', () => {
    const token = makeActiveToken();
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('rationale' in result.decision).toBe(false);
    }
  });

  it('includes channel info in the validated decision', () => {
    const token = makeActiveToken();
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.channel.kind).toBe('slack');
    }
  });

  it('accepts RequestChanges action', () => {
    const token = makeActiveToken();
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'RequestChanges',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
      rationale: 'Please update blast radius analysis',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.decision).toBe('RequestChanges');
    }
  });
});

// ---------------------------------------------------------------------------
// validateTokenConsumption — rejection
// ---------------------------------------------------------------------------

describe('validateTokenConsumption — rejection', () => {
  it('rejects consumed token', () => {
    const token = makeActiveToken({ status: 'consumed' });
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('token_already_consumed');
      expect(result.message).toContain('already been used');
    }
  });

  it('rejects revoked token', () => {
    const token = makeActiveToken({ status: 'revoked' });
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('token_revoked');
    }
  });

  it('rejects expired token (status)', () => {
    const token = makeActiveToken({ status: 'expired' });
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('token_expired');
    }
  });

  it('rejects token past expiry time even if status is active', () => {
    const token = makeActiveToken({ expiresAtIso: '2026-02-23T11:30:00Z' });
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW, // 12:00 > 11:30
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('token_expired');
    }
  });

  it('rejects when identity does not match', () => {
    const token = makeActiveToken();
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_ALICE, // Token was issued to BOB
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('identity_mismatch');
      expect(result.message).toContain('different user');
    }
  });

  it('rejects when action is not permitted', () => {
    const token = makeActiveToken({ permittedActions: ['approve'] }); // only approve
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Denied',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('action_not_permitted');
      expect(result.message).toContain('Denied');
    }
  });

  it('rejects when payload hash has changed (TOCTOU)', () => {
    const token = makeActiveToken();
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: HashSha256('sha256-changed-xyz'),
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('payload_changed');
      expect(result.message).toContain('changed');
    }
  });
});

// ---------------------------------------------------------------------------
// validateTokenConsumption — edge cases
// ---------------------------------------------------------------------------

describe('validateTokenConsumption — edge cases', () => {
  it('rejects at exact expiry time (boundary)', () => {
    const token = makeActiveToken({ expiresAtIso: NOW });
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW, // exactly at expiry
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('token_expired');
    }
  });

  it('accepts one millisecond before expiry', () => {
    const token = makeActiveToken({ expiresAtIso: '2026-02-23T12:00:01Z' });
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW, // 12:00:00 < 12:00:01
    });

    expect(result.ok).toBe(true);
  });

  it('checks status before time-based expiry (consumed takes precedence)', () => {
    // Token is consumed but would also be expired by time
    const token = makeActiveToken({
      status: 'consumed',
      expiresAtIso: '2026-02-23T11:00:00Z',
    });
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Status check runs first
      expect(result.reason).toBe('token_already_consumed');
    }
  });
});

// ---------------------------------------------------------------------------
// isOffPlatformChannelKind
// ---------------------------------------------------------------------------

describe('isOffPlatformChannelKind', () => {
  it.each(['slack', 'teams', 'email', 'mobile_push', 'webhook'] as const)(
    'returns true for %s',
    (kind) => {
      expect(isOffPlatformChannelKind(kind)).toBe(true);
    },
  );

  it('returns false for unknown kinds', () => {
    expect(isOffPlatformChannelKind('unknown')).toBe(false);
    expect(isOffPlatformChannelKind('')).toBe(false);
    expect(isOffPlatformChannelKind('Slack')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Channel type coverage
// ---------------------------------------------------------------------------

describe('OffPlatformChannelV1 — all channel kinds', () => {
  it('creates a Teams channel', () => {
    const channel: OffPlatformChannelV1 = {
      kind: 'teams',
      conversationId: 'conv-123',
      activityId: 'act-456',
    };
    expect(channel.kind).toBe('teams');
  });

  it('creates an email channel', () => {
    const channel: OffPlatformChannelV1 = {
      kind: 'email',
      recipientEmail: 'bob@example.com',
      messageId: '<msg-123@example.com>',
    };
    expect(channel.kind).toBe('email');
  });

  it('creates a mobile_push channel', () => {
    const channel: OffPlatformChannelV1 = {
      kind: 'mobile_push',
      deviceTokenHash: 'sha256-device-abc',
    };
    expect(channel.kind).toBe('mobile_push');
  });

  it('creates a webhook channel', () => {
    const channel: OffPlatformChannelV1 = {
      kind: 'webhook',
      webhookEndpointId: 'wh-endpoint-1',
    };
    expect(channel.kind).toBe('webhook');
  });
});

// ---------------------------------------------------------------------------
// Token with different channels
// ---------------------------------------------------------------------------

describe('validateTokenConsumption — different channels', () => {
  it('validates token issued via email channel', () => {
    const token = makeActiveToken({
      channel: { kind: 'email', recipientEmail: 'bob@example.com' },
    });
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Approved',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.channel.kind).toBe('email');
    }
  });

  it('validates token issued via webhook channel', () => {
    const token = makeActiveToken({
      channel: { kind: 'webhook', webhookEndpointId: 'wh-1' },
    });
    const result = validateTokenConsumption(token, {
      attemptedByUserId: USER_BOB,
      attemptedAction: 'Denied',
      currentPayloadHash: PAYLOAD_HASH,
      nowIso: NOW,
      rationale: 'Not appropriate',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.channel.kind).toBe('webhook');
    }
  });
});
