import { describe, expect, it } from 'vitest';

import {
  ActionId,
  ApprovalId,
  PolicyChangeId,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
  WorkforceQueueId,
  type ExecutionTier,
} from '../primitives/index.js';
import {
  AUTONOMY_SCOPE_PRECEDENCE_V1,
  compareAutonomyControlStrictnessV1,
  parseAutonomyControlRuleV1,
  parseAutonomyWeakeningOverrideV1,
  resolveAutonomyControlsV1,
  type AutonomyControlRuleV1,
  type AutonomyEvaluationTargetV1,
  type AutonomyWeakeningOverrideV1,
} from './delegated-autonomy-hierarchy-v1.js';

const TENANT_ID = TenantId('tenant-1');
const WORKSPACE_ID = WorkspaceId('ws-1');
const RUN_ID = RunId('run-1');
const ACTION_ID = ActionId('act-1');
const QUEUE_ID = WorkforceQueueId('queue-finance');
const NOW = '2026-04-01T12:00:00.000Z';

const TARGET: AutonomyEvaluationTargetV1 = {
  tenantId: TENANT_ID,
  workspaceId: WORKSPACE_ID,
  roles: ['operator'],
  workforceQueueId: QUEUE_ID,
  runId: RUN_ID,
  actionId: ACTION_ID,
  actionClass: 'payments.transfer',
};

function tierRule(
  ruleId: string,
  scope: AutonomyControlRuleV1['scope'],
  tier: ExecutionTier,
  overrides: Partial<AutonomyControlRuleV1> = {},
): AutonomyControlRuleV1 {
  return {
    schemaVersion: 1,
    ruleId,
    scope,
    control: { kind: 'execution-tier', tier },
    limitStrength: 'default',
    rationale: `${ruleId} rationale`,
    ...overrides,
  };
}

function budgetRule(
  ruleId: string,
  scope: AutonomyControlRuleV1['scope'],
  amountMinor: number,
  overrides: Partial<AutonomyControlRuleV1> = {},
): AutonomyControlRuleV1 {
  return {
    schemaVersion: 1,
    ruleId,
    scope,
    control: { kind: 'budget-limit', amountMinor, currency: 'AUD' },
    limitStrength: 'default',
    rationale: `${ruleId} rationale`,
    ...overrides,
  };
}

function prohibitionRule(
  ruleId: string,
  scope: AutonomyControlRuleV1['scope'],
  prohibited: boolean,
  overrides: Partial<AutonomyControlRuleV1> = {},
): AutonomyControlRuleV1 {
  return {
    schemaVersion: 1,
    ruleId,
    scope,
    control: { kind: 'action-prohibition', prohibited },
    limitStrength: 'default',
    rationale: `${ruleId} rationale`,
    ...overrides,
  };
}

function approvedOverride(
  targetRuleId: string,
  weakeningRuleId: string,
): AutonomyWeakeningOverrideV1 {
  return {
    schemaVersion: 1,
    overrideId: 'override-1',
    source: 'policy-change-approval',
    targetRuleId,
    weakeningRuleId,
    approvedByUserId: UserId('checker-1'),
    approvedAtIso: '2026-04-01T11:00:00.000Z',
    approvalId: ApprovalId('approval-1'),
    policyChangeId: PolicyChangeId('pc-1'),
    rationale: 'Temporary approved weakening for incident recovery.',
  };
}

describe('delegated autonomy hierarchy v1', () => {
  it('documents deterministic scope precedence from platform baseline to Action', () => {
    expect(AUTONOMY_SCOPE_PRECEDENCE_V1).toEqual([
      'PlatformBaseline',
      'Tenant',
      'Workspace',
      'RoleOrQueue',
      'RunCharter',
      'Action',
    ]);
  });

  it('lets lower scopes tighten tier, budget, and prohibition controls', () => {
    const result = resolveAutonomyControlsV1({
      mode: 'simulation',
      target: TARGET,
      evaluatedAtIso: NOW,
      rules: [
        tierRule('platform-tier', { scopeKind: 'PlatformBaseline' }, 'Auto'),
        tierRule('tenant-tier', { scopeKind: 'Tenant', tenantId: TENANT_ID }, 'Assisted'),
        budgetRule(
          'workspace-budget',
          { scopeKind: 'Workspace', workspaceId: WORKSPACE_ID },
          50_000,
        ),
        budgetRule(
          'run-budget',
          { scopeKind: 'RunCharter', workspaceId: WORKSPACE_ID, runId: RUN_ID },
          10_000,
        ),
        prohibitionRule(
          'action-prohibit',
          {
            scopeKind: 'Action',
            workspaceId: WORKSPACE_ID,
            actionId: ACTION_ID,
            actionClass: 'payments.transfer',
          },
          true,
        ),
      ],
    });

    expect(result.decision).toBe('Deny');
    expect(result.effectiveExecutionTier).toBe('Assisted');
    expect(result.budgetLimits).toEqual([
      { amountMinor: 10_000, currency: 'AUD', ruleId: 'run-budget' },
    ]);
    expect(result.prohibited).toBe(true);
    expect(result.traces.map((trace) => trace.outcome)).toContain('tightened');
    expect(result.summary).toContain('action prohibition');
  });

  it('blocks lower-scope weakening of higher-scope hard limits without a valid override', () => {
    const result = resolveAutonomyControlsV1({
      mode: 'runtime',
      target: TARGET,
      evaluatedAtIso: NOW,
      rules: [
        tierRule('tenant-hard-tier', { scopeKind: 'Tenant', tenantId: TENANT_ID }, 'HumanApprove', {
          limitStrength: 'hard-limit',
          allowWeakeningWithApproval: true,
        }),
        tierRule(
          'action-auto-tier',
          {
            scopeKind: 'Action',
            workspaceId: WORKSPACE_ID,
            actionClass: 'payments.transfer',
          },
          'Auto',
        ),
      ],
    });

    expect(result.decision).toBe('RequireApproval');
    expect(result.effectiveExecutionTier).toBe('HumanApprove');
    expect(result.blockedWeakeningAttempts).toEqual([
      expect.objectContaining({
        higherRuleId: 'tenant-hard-tier',
        weakeningRuleId: 'action-auto-tier',
        reason: 'missing-approved-override',
      }),
    ]);
  });

  it('does not let an equal lower-scope default erase a higher hard limit before later weakening', () => {
    const result = resolveAutonomyControlsV1({
      mode: 'runtime',
      target: TARGET,
      evaluatedAtIso: NOW,
      rules: [
        tierRule('tenant-hard-tier', { scopeKind: 'Tenant', tenantId: TENANT_ID }, 'HumanApprove', {
          limitStrength: 'hard-limit',
          allowWeakeningWithApproval: true,
        }),
        tierRule(
          'workspace-same-default',
          { scopeKind: 'Workspace', workspaceId: WORKSPACE_ID },
          'HumanApprove',
        ),
        tierRule(
          'action-auto-tier',
          {
            scopeKind: 'Action',
            workspaceId: WORKSPACE_ID,
            actionClass: 'payments.transfer',
          },
          'Auto',
        ),
      ],
    });

    expect(result.effectiveExecutionTier).toBe('HumanApprove');
    expect(result.effectiveControls[0]).toMatchObject({
      ruleId: 'tenant-hard-tier',
      limitStrength: 'hard-limit',
    });
    expect(result.blockedWeakeningAttempts[0]).toMatchObject({
      higherRuleId: 'tenant-hard-tier',
      weakeningRuleId: 'action-auto-tier',
    });
  });

  it('allows weakening a hard limit through approved policy-change override metadata', () => {
    const result = resolveAutonomyControlsV1({
      mode: 'audit',
      target: TARGET,
      evaluatedAtIso: NOW,
      overrides: [approvedOverride('tenant-hard-tier', 'action-auto-tier')],
      rules: [
        tierRule('tenant-hard-tier', { scopeKind: 'Tenant', tenantId: TENANT_ID }, 'HumanApprove', {
          limitStrength: 'hard-limit',
          allowWeakeningWithApproval: true,
        }),
        tierRule(
          'action-auto-tier',
          {
            scopeKind: 'Action',
            workspaceId: WORKSPACE_ID,
            actionClass: 'payments.transfer',
          },
          'Auto',
        ),
      ],
    });

    expect(result.decision).toBe('Allow');
    expect(result.effectiveExecutionTier).toBe('Auto');
    expect(result.effectiveControls[0]?.overrideApplied).toMatchObject({
      source: 'policy-change-approval',
      approvalId: 'approval-1',
      policyChangeId: 'pc-1',
    });
    expect(result.traces).toContainEqual(
      expect.objectContaining({ ruleId: 'action-auto-tier', outcome: 'override-weakened' }),
    );
  });

  it('allows temporary break-glass weakening only while the override is live', () => {
    const breakGlass = parseAutonomyWeakeningOverrideV1({
      schemaVersion: 1,
      overrideId: 'break-glass-1',
      source: 'incident-break-glass',
      targetRuleId: 'workspace-hard-budget',
      weakeningRuleId: 'run-higher-budget',
      approvedByUserId: 'platform-admin-1',
      approvedAtIso: '2026-04-01T11:00:00.000Z',
      expiresAtIso: '2026-04-01T13:00:00.000Z',
      postIncidentReviewRequired: true,
      rationale: 'Restore service during incident.',
    });

    const result = resolveAutonomyControlsV1({
      mode: 'runtime',
      target: TARGET,
      evaluatedAtIso: NOW,
      overrides: [breakGlass],
      rules: [
        budgetRule(
          'workspace-hard-budget',
          { scopeKind: 'Workspace', workspaceId: WORKSPACE_ID },
          5_000,
          { limitStrength: 'hard-limit', allowWeakeningWithApproval: true },
        ),
        budgetRule(
          'run-higher-budget',
          { scopeKind: 'RunCharter', workspaceId: WORKSPACE_ID, runId: RUN_ID },
          20_000,
        ),
      ],
    });

    expect(result.budgetLimits).toEqual([
      { amountMinor: 20_000, currency: 'AUD', ruleId: 'run-higher-budget' },
    ]);
    expect(result.effectiveControls[0]?.overrideApplied?.source).toBe('incident-break-glass');

    const expired = resolveAutonomyControlsV1({
      mode: 'runtime',
      target: TARGET,
      evaluatedAtIso: '2026-04-01T13:00:00.000Z',
      overrides: [breakGlass],
      rules: [
        budgetRule(
          'workspace-hard-budget',
          { scopeKind: 'Workspace', workspaceId: WORKSPACE_ID },
          5_000,
          { limitStrength: 'hard-limit', allowWeakeningWithApproval: true },
        ),
        budgetRule(
          'run-higher-budget',
          { scopeKind: 'RunCharter', workspaceId: WORKSPACE_ID, runId: RUN_ID },
          20_000,
        ),
      ],
    });

    expect(expired.budgetLimits[0]?.amountMinor).toBe(5_000);
    expect(expired.blockedWeakeningAttempts[0]?.reason).toBe('expired-or-invalid-override');
  });

  it('does not allow non-overridable platform invariants to be bypassed', () => {
    const result = resolveAutonomyControlsV1({
      mode: 'runtime',
      target: TARGET,
      evaluatedAtIso: NOW,
      overrides: [approvedOverride('platform-no-governance-bypass', 'action-allow')],
      rules: [
        prohibitionRule('platform-no-governance-bypass', { scopeKind: 'PlatformBaseline' }, true, {
          limitStrength: 'platform-invariant',
        }),
        prohibitionRule(
          'action-allow',
          {
            scopeKind: 'Action',
            workspaceId: WORKSPACE_ID,
            actionClass: 'payments.transfer',
          },
          false,
        ),
      ],
    });

    expect(result.decision).toBe('Deny');
    expect(result.prohibited).toBe(true);
    expect(result.blockedWeakeningAttempts[0]).toMatchObject({
      higherRuleId: 'platform-no-governance-bypass',
      weakeningRuleId: 'action-allow',
      reason: 'platform-invariant',
      requiredAuthoritySources: [],
    });
  });

  it('matches RoleOrQueue controls against current RBAC role and Workforce Queue context', () => {
    const result = resolveAutonomyControlsV1({
      mode: 'policy-authoring',
      target: TARGET,
      evaluatedAtIso: NOW,
      rules: [
        tierRule(
          'workspace-default',
          { scopeKind: 'Workspace', workspaceId: WORKSPACE_ID },
          'Auto',
        ),
        tierRule(
          'finance-queue-tier',
          {
            scopeKind: 'RoleOrQueue',
            workspaceId: WORKSPACE_ID,
            role: 'operator',
            workforceQueueId: QUEUE_ID,
          },
          'HumanApprove',
        ),
      ],
    });

    expect(result.decision).toBe('RequireApproval');
    expect(result.effectiveControls[0]).toMatchObject({
      ruleId: 'finance-queue-tier',
      scopeKind: 'RoleOrQueue',
    });
  });

  it('parses rule and override contracts with validation for invariant and break-glass semantics', () => {
    expect(
      parseAutonomyControlRuleV1({
        schemaVersion: 1,
        ruleId: 'tenant-tier',
        scope: { scopeKind: 'Tenant', tenantId: 'tenant-1' },
        control: { kind: 'execution-tier', tier: 'HumanApprove' },
        limitStrength: 'hard-limit',
        allowWeakeningWithApproval: true,
        rationale: 'Tenant requires approval for payments.',
      }),
    ).toMatchObject({ ruleId: 'tenant-tier', limitStrength: 'hard-limit' });

    expect(() =>
      parseAutonomyControlRuleV1({
        schemaVersion: 1,
        ruleId: 'bad-invariant',
        scope: { scopeKind: 'Workspace', workspaceId: 'ws-1' },
        control: { kind: 'action-prohibition', prohibited: true },
        limitStrength: 'platform-invariant',
        rationale: 'Invalid.',
      }),
    ).toThrow(/PlatformBaseline/);

    expect(() =>
      parseAutonomyWeakeningOverrideV1({
        schemaVersion: 1,
        overrideId: 'bad-break-glass',
        source: 'incident-break-glass',
        targetRuleId: 'tenant-hard',
        weakeningRuleId: 'action-auto',
        approvedByUserId: 'admin-1',
        approvedAtIso: NOW,
        rationale: 'Missing expiry.',
      }),
    ).toThrow(/expiresAtIso/);
  });

  it('compares strictness consistently across tier, budget, and prohibition controls', () => {
    expect(
      compareAutonomyControlStrictnessV1(
        { kind: 'execution-tier', tier: 'Assisted' },
        { kind: 'execution-tier', tier: 'HumanApprove' },
      ),
    ).toBe('stricter');
    expect(
      compareAutonomyControlStrictnessV1(
        { kind: 'budget-limit', amountMinor: 10_000, currency: 'AUD' },
        { kind: 'budget-limit', amountMinor: 20_000, currency: 'AUD' },
      ),
    ).toBe('weaker');
    expect(
      compareAutonomyControlStrictnessV1(
        { kind: 'action-prohibition', prohibited: true },
        { kind: 'action-prohibition', prohibited: false },
      ),
    ).toBe('weaker');
  });
});
