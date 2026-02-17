import { describe, expect, it } from 'vitest';

import {
  ActionId,
  UserId,
  WorkflowId,
  WorkspaceId,
  PolicyId,
  type ExecutionTier,
  type PortFamily,
} from '../primitives/index.js';
import type { WorkflowV1 } from '../workflows/workflow-v1.js';
import type { PolicyV1 } from '../policy/policy-v1.js';

import { determineRequiredApprovals } from './approval-routing.js';

const makeWorkflow = (tier: ExecutionTier, actions?: WorkflowV1['actions']): WorkflowV1 => ({
  schemaVersion: 1,
  workflowId: WorkflowId('wf-1'),
  workspaceId: WorkspaceId('ws-1'),
  name: 'Test Workflow',
  version: 1,
  active: true,
  executionTier: tier,
  actions: actions ?? [
    {
      actionId: ActionId('act-1'),
      order: 1,
      portFamily: 'FinanceAccounting' as PortFamily,
      operation: 'invoice:read',
    },
  ],
});

const makePolicy = (sodConstraints?: PolicyV1['sodConstraints']): PolicyV1 => ({
  schemaVersion: 1,
  policyId: PolicyId('pol-1'),
  workspaceId: WorkspaceId('ws-1'),
  name: 'Test Policy',
  active: true,
  priority: 1,
  version: 1,
  createdAtIso: '2026-01-01T00:00:00Z',
  createdByUserId: UserId('user-admin'),
  ...(sodConstraints ? { sodConstraints } : {}),
});

const initiator = UserId('user-init');

describe('determineRequiredApprovals', () => {
  it('returns empty array when no approval required (Auto tier, no policies)', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('Auto'),
      initiatorUserId: initiator,
      policies: [],
    });

    expect(result).toEqual([]);
  });

  it('returns tier requirement for HumanApprove workflow', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('HumanApprove'),
      initiatorUserId: initiator,
      policies: [],
    });

    expect(result).toEqual([
      {
        reason: 'ExecutionTierRequiresApproval',
        minimumApprovers: 1,
        excludedUserIds: [],
      },
    ]);
  });

  it('returns tier requirement for ManualOnly workflow', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('ManualOnly'),
      initiatorUserId: initiator,
      policies: [],
    });

    expect(result).toEqual([
      {
        reason: 'ExecutionTierRequiresApproval',
        minimumApprovers: 1,
        excludedUserIds: [],
      },
    ]);
  });

  it('returns tier requirement from action executionTierOverride', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('Auto', [
        {
          actionId: ActionId('act-1'),
          order: 1,
          portFamily: 'FinanceAccounting' as PortFamily,
          operation: 'invoice:read',
          executionTierOverride: 'HumanApprove',
        },
      ]),
      initiatorUserId: initiator,
      policies: [],
    });

    expect(result).toEqual([
      {
        reason: 'ExecutionTierRequiresApproval',
        minimumApprovers: 1,
        excludedUserIds: [],
      },
    ]);
  });

  it('returns MakerChecker requirement from policy', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('Auto'),
      initiatorUserId: initiator,
      policies: [makePolicy([{ kind: 'MakerChecker' }])],
    });

    expect(result).toEqual([
      {
        reason: 'MakerCheckerRequired',
        minimumApprovers: 1,
        excludedUserIds: [initiator],
      },
    ]);
  });

  it('returns DistinctApprovers requirement from policy', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('Auto'),
      initiatorUserId: initiator,
      policies: [makePolicy([{ kind: 'DistinctApprovers', minimumApprovers: 3 }])],
    });

    expect(result).toEqual([
      {
        reason: 'DistinctApproversRequired',
        minimumApprovers: 3,
        excludedUserIds: [],
      },
    ]);
  });

  it('does not add approval requirement for IncompatibleDuties constraint', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('Auto'),
      initiatorUserId: initiator,
      policies: [
        makePolicy([
          { kind: 'IncompatibleDuties', dutyKeys: ['payment:initiate', 'payment:approve'] },
        ]),
      ],
    });

    expect(result).toEqual([]);
  });

  it('deduplicates multiple MakerChecker constraints', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('Auto'),
      initiatorUserId: initiator,
      policies: [makePolicy([{ kind: 'MakerChecker' }]), makePolicy([{ kind: 'MakerChecker' }])],
    });

    const makerCheckerResults = result.filter((r) => r.reason === 'MakerCheckerRequired');
    expect(makerCheckerResults).toHaveLength(1);
    expect(makerCheckerResults[0]).toEqual({
      reason: 'MakerCheckerRequired',
      minimumApprovers: 1,
      excludedUserIds: [initiator],
    });
  });

  it('keeps highest minimumApprovers for DistinctApprovers', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('Auto'),
      initiatorUserId: initiator,
      policies: [
        makePolicy([{ kind: 'DistinctApprovers', minimumApprovers: 2 }]),
        makePolicy([{ kind: 'DistinctApprovers', minimumApprovers: 5 }]),
        makePolicy([{ kind: 'DistinctApprovers', minimumApprovers: 3 }]),
      ],
    });

    const distinctResults = result.filter((r) => r.reason === 'DistinctApproversRequired');
    expect(distinctResults).toHaveLength(1);
    expect(distinctResults[0]!.minimumApprovers).toBe(5);
  });

  it('combines tier + SoD requirements', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('HumanApprove'),
      initiatorUserId: initiator,
      policies: [
        makePolicy([{ kind: 'MakerChecker' }, { kind: 'DistinctApprovers', minimumApprovers: 2 }]),
      ],
    });

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.reason)).toEqual([
      'ExecutionTierRequiresApproval',
      'MakerCheckerRequired',
      'DistinctApproversRequired',
    ]);
  });

  it('deduplicates ExecutionTierRequiresApproval from workflow + action overrides', () => {
    const result = determineRequiredApprovals({
      workflow: makeWorkflow('HumanApprove', [
        {
          actionId: ActionId('act-1'),
          order: 1,
          portFamily: 'FinanceAccounting' as PortFamily,
          operation: 'invoice:read',
          executionTierOverride: 'ManualOnly',
        },
      ]),
      initiatorUserId: initiator,
      policies: [],
    });

    const tierResults = result.filter((r) => r.reason === 'ExecutionTierRequiresApproval');
    expect(tierResults).toHaveLength(1);
  });
});
