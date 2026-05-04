import { describe, expect, it } from 'vitest';

import {
  evaluateGrowthStudioApprovalPolicyV1,
  GROWTH_STUDIO_DRAFT_APPROVAL_DUTY,
  GROWTH_STUDIO_HUMAN_APPROVAL_TOOLS,
  GROWTH_STUDIO_MANUAL_ONLY_TOOLS,
  GROWTH_STUDIO_PUBLISH_APPROVAL_DUTY,
  GROWTH_STUDIO_READ_ONLY_TOOLS,
  makeGrowthStudioApprovalPolicyFixtureV1,
  makeGrowthStudioPolicyRuleContextV1,
} from '../../domain/policy/growth-studio-approval-policy-v1.js';
import { evaluateSodConstraintsV1 } from '../../domain/policy/sod-constraints-v1.js';
import { UserId } from '../../domain/primitives/index.js';
import { evaluatePolicy } from '../../domain/services/policy-evaluation.js';

describe('Growth Studio approval policy integration', () => {
  it('returns the required approval tier for each Growth Studio tool', () => {
    for (const toolName of GROWTH_STUDIO_READ_ONLY_TOOLS) {
      expect(evaluateGrowthStudioApprovalPolicyV1({ toolName }).requiredTier).toBe('Auto');
    }

    for (const toolName of GROWTH_STUDIO_HUMAN_APPROVAL_TOOLS) {
      expect(evaluateGrowthStudioApprovalPolicyV1({ toolName }).requiredTier).toBe('HumanApprove');
    }

    for (const toolName of GROWTH_STUDIO_MANUAL_ONLY_TOOLS) {
      expect(evaluateGrowthStudioApprovalPolicyV1({ toolName }).requiredTier).toBe('ManualOnly');
    }
  });

  it('escalates batch and budget guard matches to ManualOnly', () => {
    expect(
      evaluateGrowthStudioApprovalPolicyV1({
        toolName: 'read-crm-contact',
        contactCount: 6,
      }),
    ).toMatchObject({
      requiredTier: 'ManualOnly',
      matchedRuleIds: expect.arrayContaining(['growth-studio-batch-manual-only']),
    });

    expect(
      evaluateGrowthStudioApprovalPolicyV1({
        toolName: 'draft-email',
        estimatedCostUsd: 51,
      }),
    ).toMatchObject({
      requiredTier: 'ManualOnly',
      matchedRuleIds: expect.arrayContaining(['growth-studio-budget-manual-only']),
    });
  });

  it('exposes approval timeouts for routed work', () => {
    expect(evaluateGrowthStudioApprovalPolicyV1({ toolName: 'draft-email' }).timeout).toEqual({
      tier: 'HumanApprove',
      timeoutMs: 15 * 60 * 1000,
      onExpiry: 'DenyAndNotifyOperator',
    });

    expect(evaluateGrowthStudioApprovalPolicyV1({ toolName: 'send-email' }).timeout).toEqual({
      tier: 'ManualOnly',
      timeoutMs: 60 * 60 * 1000,
      onExpiry: 'DenyAndEscalateToAdmin',
    });
  });

  it('keeps policy rules expressible in the existing inline condition DSL', () => {
    const policy = makeGrowthStudioApprovalPolicyFixtureV1();

    expect(
      evaluatePolicy({
        policy,
        context: {
          initiatorUserId: UserId('agent-1'),
          approverUserIds: [],
          executionTier: 'Auto',
          ruleContext: makeGrowthStudioPolicyRuleContextV1({
            toolName: 'read-analytics',
            requestedTier: 'Auto',
          }),
        },
      }).decision,
    ).toBe('Allow');

    expect(
      evaluatePolicy({
        policy,
        context: {
          initiatorUserId: UserId('agent-1'),
          approverUserIds: [],
          executionTier: 'Auto',
          ruleContext: makeGrowthStudioPolicyRuleContextV1({
            toolName: 'draft-email',
            requestedTier: 'Auto',
          }),
        },
      }).decision,
    ).toBe('Deny');

    expect(
      evaluatePolicy({
        policy,
        context: {
          initiatorUserId: UserId('agent-1'),
          approverUserIds: [UserId('operator-1')],
          executionTier: 'ManualOnly',
          ruleContext: makeGrowthStudioPolicyRuleContextV1({
            toolName: 'publish-linkedin-post',
            requestedTier: 'ManualOnly',
            draftApproved: false,
          }),
        },
      }).decision,
    ).toBe('Deny');
  });

  it('maps Growth Studio SoD requirements onto existing constraint types', () => {
    const evaluation = evaluateGrowthStudioApprovalPolicyV1({
      toolName: 'publish-blog-article',
      draftApproved: true,
    });

    expect(evaluation.sodConstraints).toEqual(
      expect.arrayContaining([
        { kind: 'MakerChecker' },
        { kind: 'DistinctApprovers', minimumApprovers: 2 },
        {
          kind: 'IncompatibleDuties',
          dutyKeys: [GROWTH_STUDIO_DRAFT_APPROVAL_DUTY, GROWTH_STUDIO_PUBLISH_APPROVAL_DUTY],
        },
      ]),
    );

    expect(
      evaluateSodConstraintsV1({
        constraints: evaluation.sodConstraints,
        context: {
          initiatorUserId: UserId('agent-1'),
          approverUserIds: [UserId('operator-1'), UserId('operator-2')],
          performedDuties: [
            {
              userId: UserId('operator-1'),
              dutyKey: GROWTH_STUDIO_DRAFT_APPROVAL_DUTY,
            },
            {
              userId: UserId('operator-1'),
              dutyKey: GROWTH_STUDIO_PUBLISH_APPROVAL_DUTY,
            },
          ],
        },
      }),
    ).toEqual([
      {
        kind: 'IncompatibleDutiesViolation',
        userId: UserId('operator-1'),
        dutyKeys: [GROWTH_STUDIO_DRAFT_APPROVAL_DUTY, GROWTH_STUDIO_PUBLISH_APPROVAL_DUTY],
        constraintDutyKeys: [
          GROWTH_STUDIO_DRAFT_APPROVAL_DUTY,
          GROWTH_STUDIO_PUBLISH_APPROVAL_DUTY,
        ],
      },
    ]);
  });
});
