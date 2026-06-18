/**
 * Experiment: approval-consumer-reconciler
 *
 * Models the approval decision consumer that should sit after Cockpit records
 * an operator decision. The approval button records intent; this reconciler
 * decides the safe next step and emits an idempotent outbox intent.
 */

// @ts-check

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runExperiment, assert } from '../shared/experiment-runner.js';

const EXPERIMENT_NAME = 'approval-consumer-reconciler';
const SAFE_EXECUTABLE_ACTIONS = new Set([
  'tenant.status',
  'tenant.cost_status',
  'example.safe_status',
  'safe_status',
]);

const REVIEW_ONLY_ACTIONS = new Set([
  'standing_read_attention_review',
  'standing_read_monitor_review',
  'standing_read_review',
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(/** @type {Record<string, unknown>} */ (value))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function hashValue(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex').slice(0, 24);
}

/**
 * @param {Record<string, unknown>} approval
 * @returns {string}
 */
function actionTypeOf(approval) {
  return String(approval.actionType ?? '').trim();
}

/**
 * @param {Record<string, unknown>} approval
 * @returns {string}
 */
function authorityOf(approval) {
  return String(approval.authorityLevel ?? '')
    .trim()
    .toUpperCase();
}

/**
 * @param {Record<string, unknown>} approval
 * @returns {boolean}
 */
function isStandingReadMonitorReview(approval) {
  const actionType = actionTypeOf(approval);
  const target = String(approval.target ?? '').toLowerCase();
  const plan = /** @type {Record<string, unknown>} */ (approval.plan ?? {});
  const origin = String(plan.origin ?? plan.category ?? '').toLowerCase();

  return (
    REVIEW_ONLY_ACTIONS.has(actionType) ||
    (actionType === 'email_query' &&
      (origin.includes('standing-read') || target.includes('watch') || target.includes('monitor')))
  );
}

/**
 * @param {Record<string, unknown>} approval
 * @returns {boolean}
 */
function hasExactScopedBrowserQuery(approval) {
  const scope = /** @type {Record<string, unknown>} */ (approval.scope ?? {});
  return (
    actionTypeOf(approval) === 'tenant.cloud_browser_query' &&
    authorityOf(approval) === 'A3' &&
    scope.scopeHashMatches === true &&
    scope.redactedOutput === true &&
    typeof scope.profileId === 'string' &&
    Array.isArray(scope.queryTerms) &&
    scope.queryTerms.length > 0
  );
}

/**
 * @param {Record<string, unknown>} approval
 */
function classifyApprovedApproval(approval) {
  const actionType = actionTypeOf(approval);
  const authority = authorityOf(approval);

  if (isStandingReadMonitorReview(approval)) {
    return {
      class: 'review-consumption',
      action: 'record-review-consumed',
      requiresExecutorGate: false,
      reason: 'Approval records operator intent for a review artifact; no external action runs.',
    };
  }

  if (SAFE_EXECUTABLE_ACTIONS.has(actionType) && ['A0', 'A1', 'A2', 'A3'].includes(authority)) {
    return {
      class: 'safe-executable',
      action: 'dispatch-through-executor-gate',
      requiresExecutorGate: true,
      reason: 'Allowlisted safe/status action can be dispatched only through the executor gate.',
    };
  }

  if (hasExactScopedBrowserQuery(approval)) {
    return {
      class: 'scoped-browser-query',
      action: 'dispatch-through-scoped-browser-gate',
      requiresExecutorGate: true,
      reason: 'Exact scoped browser query can run only through direct gate with redacted output.',
    };
  }

  return {
    class: 'blocked-needs-narrower-proposal',
    action: 'draft-narrower-proposal',
    requiresExecutorGate: false,
    reason: 'Approved card is too broad, unsupported, or consequence-heavy for automatic dispatch.',
  };
}

/**
 * @param {Record<string, unknown>} approval
 * @param {string} actionClass
 * @returns {string}
 */
function consumptionKeyFor(approval, actionClass) {
  return `${approval.approvalId}:${actionClass}:${hashValue({
    actionType: approval.actionType,
    target: approval.target,
    scope: approval.scope ?? null,
    plan: approval.plan ?? null,
  })}`;
}

/**
 * @param {{
 *   approvals: readonly Record<string, unknown>[],
 *   consumedKeys: ReadonlySet<string>,
 *   nowIso: string,
 * }} input
 */
function reconcileApprovals(input) {
  const plans = [];
  const outbox = [];

  for (const approval of input.approvals) {
    const status = String(approval.status ?? '');

    if (status === 'Pending') {
      plans.push({
        approvalId: approval.approvalId,
        status,
        class: 'waiting-for-decision',
        action: 'wait',
        outboxEntryId: null,
      });
      continue;
    }

    if (status === 'RequestChanges') {
      const entryId = `outbox-${hashValue({ approval, action: 'request-changes' })}`;
      plans.push({
        approvalId: approval.approvalId,
        status,
        class: 'revision-requested',
        action: 'notify-requester-for-revision',
        outboxEntryId: entryId,
      });
      outbox.push({
        entryId,
        eventType: 'ApprovalRevisionRequested',
        approvalId: approval.approvalId,
        occurredAtIso: input.nowIso,
      });
      continue;
    }

    if (status === 'Denied' || status === 'Expired' || status === 'Executed') {
      plans.push({
        approvalId: approval.approvalId,
        status,
        class: 'terminal-noop',
        action: 'do-not-dispatch',
        outboxEntryId: null,
      });
      continue;
    }

    if (status !== 'Approved') {
      plans.push({
        approvalId: approval.approvalId,
        status,
        class: 'unknown-status-blocked',
        action: 'manual-review',
        outboxEntryId: null,
      });
      continue;
    }

    const classification = classifyApprovedApproval(approval);
    const consumptionKey = consumptionKeyFor(approval, classification.class);

    if (input.consumedKeys.has(consumptionKey)) {
      plans.push({
        approvalId: approval.approvalId,
        status,
        class: 'already-consumed',
        action: 'do-not-duplicate',
        consumptionKey,
        outboxEntryId: null,
      });
      continue;
    }

    const eventType =
      classification.class === 'review-consumption'
        ? 'ApprovalReviewConsumptionPlanned'
        : classification.class === 'blocked-needs-narrower-proposal'
          ? 'ApprovalFollowupProposalPlanned'
          : 'ApprovedActionExecutionPlanned';
    const outboxEntryId = `outbox-${hashValue({ consumptionKey, eventType })}`;

    const plan = {
      approvalId: approval.approvalId,
      status,
      actionType: actionTypeOf(approval),
      ...classification,
      consumptionKey,
      outboxEntryId,
    };
    plans.push(plan);
    outbox.push({
      entryId: outboxEntryId,
      eventType,
      approvalId: approval.approvalId,
      consumptionKey,
      action: classification.action,
      requiresExecutorGate: classification.requiresExecutorGate,
      occurredAtIso: input.nowIso,
    });
  }

  return { plans, outbox };
}

const fixtures = [
  {
    approvalId: 'appr-review-standing-1',
    status: 'Approved',
    actionType: 'standing_read_attention_review',
    authorityLevel: 'A3',
    target: 'learning-platform:standing-read-monitor',
    plan: { origin: 'standing-read-monitor' },
  },
  {
    approvalId: 'appr-safe-status-1',
    status: 'Approved',
    actionType: 'tenant.status',
    authorityLevel: 'A0',
    target: 'tenant-runtime',
  },
  {
    approvalId: 'appr-scoped-browser-1',
    status: 'Approved',
    actionType: 'tenant.cloud_browser_query',
    authorityLevel: 'A3',
    target: 'learning-dashboard',
    scope: {
      profileId: 'learning-platform',
      queryTerms: ['census date'],
      redactedOutput: true,
      scopeHashMatches: true,
    },
  },
  {
    approvalId: 'appr-email-watch-1',
    status: 'Approved',
    actionType: 'email_query',
    authorityLevel: 'A3',
    target: 'email-learning-platform:priority-watch',
    plan: { origin: 'standing-read-monitor' },
  },
  {
    approvalId: 'appr-broad-mutation-1',
    status: 'Approved',
    actionType: 'change_spend_cap',
    authorityLevel: 'A4',
    target: 'OpenRouter cap',
    externalSideEffect: true,
  },
  {
    approvalId: 'appr-pending-1',
    status: 'Pending',
    actionType: 'tenant.status',
    authorityLevel: 'A0',
    target: 'tenant-runtime',
  },
  {
    approvalId: 'appr-revision-1',
    status: 'RequestChanges',
    actionType: 'tenant.status',
    authorityLevel: 'A0',
    target: 'tenant-runtime',
  },
  {
    approvalId: 'appr-denied-1',
    status: 'Denied',
    actionType: 'tenant.status',
    authorityLevel: 'A0',
    target: 'tenant-runtime',
  },
  {
    approvalId: 'appr-duplicate-1',
    status: 'Approved',
    actionType: 'tenant.status',
    authorityLevel: 'A0',
    target: 'tenant-runtime',
  },
];

const duplicateKey = consumptionKeyFor(
  /** @type {Record<string, unknown>} */ (
    fixtures.find((item) => item.approvalId === 'appr-duplicate-1')
  ),
  'safe-executable',
);

const outcome = await runExperiment({
  name: EXPERIMENT_NAME,
  hypothesis:
    'Approval decisions can be reconciled into review consumption, gated dispatch, or narrower proposal intents without making the approval button an executor.',

  async execute(ctx) {
    ctx.state.trace = reconcileApprovals({
      approvals: fixtures,
      consumedKeys: new Set([duplicateKey]),
      nowIso: '2026-06-14T02:30:00.000Z',
    });
    writeFileSync(
      join(ctx.resultsDir, 'reconciliation-trace.json'),
      `${JSON.stringify(ctx.state.trace, null, 2)}\n`,
    );
  },

  async verify(ctx) {
    const trace =
      /** @type {{ plans: Record<string, unknown>[]; outbox: Record<string, unknown>[] }} */ (
        ctx.state.trace
      );
    const byId = new Map(trace.plans.map((plan) => [plan.approvalId, plan]));
    const outboxByApproval = new Map(trace.outbox.map((entry) => [entry.approvalId, entry]));

    return [
      assert(
        'standing-read review approval is consumed without execution',
        byId.get('appr-review-standing-1')?.class === 'review-consumption' &&
          outboxByApproval.get('appr-review-standing-1')?.eventType ===
            'ApprovalReviewConsumptionPlanned' &&
          outboxByApproval.get('appr-review-standing-1')?.requiresExecutorGate === false,
      ),
      assert(
        'safe status approval plans executor-gated dispatch',
        byId.get('appr-safe-status-1')?.class === 'safe-executable' &&
          outboxByApproval.get('appr-safe-status-1')?.eventType ===
            'ApprovedActionExecutionPlanned' &&
          outboxByApproval.get('appr-safe-status-1')?.requiresExecutorGate === true,
      ),
      assert(
        'scoped browser query approval keeps direct gate and redacted scope',
        byId.get('appr-scoped-browser-1')?.class === 'scoped-browser-query' &&
          byId.get('appr-scoped-browser-1')?.action === 'dispatch-through-scoped-browser-gate' &&
          outboxByApproval.get('appr-scoped-browser-1')?.requiresExecutorGate === true,
      ),
      assert(
        'standing email watch approval is review-only, not executable email access',
        byId.get('appr-email-watch-1')?.class === 'review-consumption' &&
          outboxByApproval.get('appr-email-watch-1')?.eventType ===
            'ApprovalReviewConsumptionPlanned',
      ),
      assert(
        'broad A4 mutation approval is blocked into narrower proposal intent',
        byId.get('appr-broad-mutation-1')?.class === 'blocked-needs-narrower-proposal' &&
          outboxByApproval.get('appr-broad-mutation-1')?.eventType ===
            'ApprovalFollowupProposalPlanned' &&
          outboxByApproval.get('appr-broad-mutation-1')?.requiresExecutorGate === false,
      ),
      assert(
        'pending approval does not emit outbox work',
        byId.get('appr-pending-1')?.class === 'waiting-for-decision' &&
          !outboxByApproval.has('appr-pending-1'),
      ),
      assert(
        'request-changes approval emits revision notification intent',
        byId.get('appr-revision-1')?.class === 'revision-requested' &&
          outboxByApproval.get('appr-revision-1')?.eventType === 'ApprovalRevisionRequested',
      ),
      assert(
        'denied approval is terminal no-op',
        byId.get('appr-denied-1')?.class === 'terminal-noop' &&
          !outboxByApproval.has('appr-denied-1'),
      ),
      assert(
        'already consumed approval does not duplicate execution',
        byId.get('appr-duplicate-1')?.class === 'already-consumed' &&
          !outboxByApproval.has('appr-duplicate-1'),
      ),
    ];
  },
});

console.log(`Result: ${outcome.outcome} (${outcome.duration_ms}ms)`);
for (const item of outcome.assertions) {
  console.log(`  ${item.passed ? 'PASS' : 'FAIL'}: ${item.label}`);
}

process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
