import { describe, expect, it } from 'vitest';

import { PolicyId, RunId, UserId, WorkspaceId } from '../primitives/index.js';

import {
  evaluateAutonomyBudgetsV1,
  parseAutonomyBudgetsV1,
  parseAutonomyBudgetEvaluationContextV1,
  type AutonomyBudgetEvaluationContextV1,
} from './autonomy-budget-policy-v1.js';
import type { PolicyV1 } from './policy-v1.js';

const NOW_ISO = '2026-04-02T20:00:00.000Z';

function makePolicy(overrides: Partial<PolicyV1> = {}): PolicyV1 {
  return {
    schemaVersion: 1,
    policyId: PolicyId('pol-budget-1'),
    workspaceId: WorkspaceId('ws-1'),
    name: 'Autonomy Budget Policy',
    active: true,
    priority: 100,
    version: 1,
    createdAtIso: NOW_ISO,
    createdByUserId: UserId('user-policy-owner'),
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<AutonomyBudgetEvaluationContextV1> = {},
): AutonomyBudgetEvaluationContextV1 {
  return {
    workspaceId: WorkspaceId('ws-1'),
    runId: RunId('run-1'),
    evaluatedAtIso: NOW_ISO,
    usage: [],
    ...overrides,
  };
}

describe('parseAutonomyBudgetsV1', () => {
  it('parses workspace and run autonomy budgets', () => {
    const budgets = parseAutonomyBudgetsV1([
      {
        budgetId: 'workspace-model-spend',
        scope: 'Workspace',
        metric: 'ModelSpendCents',
        warningAt: 8_000,
        hardStopAt: 10_000,
        hardStopMode: 'FreezeWorkspace',
        rationale: 'Pilot spend cap before live business use.',
      },
      {
        budgetId: 'run-tool-calls',
        scope: 'Run',
        metric: 'ToolCalls',
        warningAt: 80,
        hardStopAt: 100,
        hardStopMode: 'KillRun',
        rationale: 'Prevent runaway tool loops.',
      },
    ]);

    expect(budgets).toHaveLength(2);
    expect(budgets[0]?.metric).toBe('ModelSpendCents');
    expect(budgets[1]?.hardStopMode).toBe('KillRun');
    expect(Object.isFrozen(budgets)).toBe(true);
  });

  it('rejects missing hard-stop separation and invalid metrics', () => {
    expect(() => parseAutonomyBudgetsV1('nope')).toThrow(/autonomyBudgets must be an array/i);
    expect(() =>
      parseAutonomyBudgetsV1([
        {
          budgetId: 'bad-thresholds',
          scope: 'Run',
          metric: 'ToolCalls',
          warningAt: 10,
          hardStopAt: 10,
          hardStopMode: 'KillRun',
          rationale: 'invalid',
        },
      ]),
    ).toThrow(/warningAt must be less than hardStopAt/i);

    expect(() =>
      parseAutonomyBudgetsV1([
        {
          budgetId: 'bad-metric',
          scope: 'Run',
          metric: 'Tokens',
          warningAt: 10,
          hardStopAt: 20,
          hardStopMode: 'KillRun',
          rationale: 'invalid',
        },
      ]),
    ).toThrow(/metric must be one of/i);
  });
});

describe('parseAutonomyBudgetEvaluationContextV1', () => {
  it('parses usage and control flags', () => {
    const context = parseAutonomyBudgetEvaluationContextV1({
      workspaceId: 'ws-1',
      runId: 'run-1',
      evaluatedAtIso: NOW_ISO,
      usage: [{ scope: 'Run', metric: 'OutboundActions', used: 3, pending: 1 }],
      runKillSwitch: true,
    });

    expect(context.runId).toBe('run-1');
    expect(context.usage[0]).toEqual({
      scope: 'Run',
      metric: 'OutboundActions',
      used: 3,
      pending: 1,
    });
    expect(context.runKillSwitch).toBe(true);
  });

  it('rejects negative usage and invalid timestamps', () => {
    expect(() =>
      parseAutonomyBudgetEvaluationContextV1({
        workspaceId: 'ws-1',
        evaluatedAtIso: 'not-a-date',
        usage: [],
      }),
    ).toThrow(/evaluatedAtIso must be a valid ISO timestamp/i);

    expect(() =>
      parseAutonomyBudgetEvaluationContextV1({
        workspaceId: 'ws-1',
        evaluatedAtIso: NOW_ISO,
        usage: [{ scope: 'Run', metric: 'ToolCalls', used: -1 }],
      }),
    ).toThrow(/used must be >= 0/i);
  });
});

describe('evaluateAutonomyBudgetsV1', () => {
  it('allows when usage is below warning thresholds', () => {
    const result = evaluateAutonomyBudgetsV1({
      policies: [
        makePolicy({
          autonomyBudgets: [
            {
              budgetId: 'run-tool-calls',
              scope: 'Run',
              metric: 'ToolCalls',
              warningAt: 80,
              hardStopAt: 100,
              hardStopMode: 'KillRun',
              rationale: 'Prevent runaway tool loops.',
            },
          ],
        }),
      ],
      context: makeContext({
        usage: [{ scope: 'Run', metric: 'ToolCalls', used: 12 }],
      }),
    });

    expect(result.decision).toBe('Allow');
    expect(result.evidence.stopClass).toBe('none');
    expect(result.operatorVisibleRationale).toMatch(/allow/i);
  });

  it('warns without blocking when soft threshold is reached', () => {
    const result = evaluateAutonomyBudgetsV1({
      policies: [
        makePolicy({
          autonomyBudgets: [
            {
              budgetId: 'workspace-approvals',
              scope: 'Workspace',
              metric: 'ApprovalRequests',
              warningAt: 20,
              hardStopAt: 25,
              hardStopMode: 'FreezeWorkspace',
              rationale: 'Approval volume needs operator review before fatigue.',
            },
          ],
        }),
      ],
      context: makeContext({
        usage: [{ scope: 'Workspace', metric: 'ApprovalRequests', used: 19, pending: 1 }],
      }),
    });

    expect(result.decision).toBe('Warn');
    expect(result.warnings).toHaveLength(1);
    expect(result.hardStops).toHaveLength(0);
    expect(result.evidence.triggerKinds).toEqual(['BudgetWarning']);
    expect(result.operatorVisibleRationale).toContain('workspace-approvals');
  });

  it('hard-stops deterministically when a run cap is exhausted', () => {
    const result = evaluateAutonomyBudgetsV1({
      policies: [
        makePolicy({
          autonomyBudgets: [
            {
              budgetId: 'run-outbound-actions',
              scope: 'Run',
              metric: 'OutboundActions',
              warningAt: 4,
              hardStopAt: 5,
              hardStopMode: 'FreezeRun',
              rationale: 'Outbound side effects must stop after the pilot cap.',
            },
          ],
        }),
      ],
      context: makeContext({
        usage: [{ scope: 'Run', metric: 'OutboundActions', used: 4, pending: 1 }],
      }),
    });

    expect(result.decision).toBe('HardStop');
    expect(result.hardStops[0]).toMatchObject({
      kind: 'BudgetHardStop',
      budgetId: 'run-outbound-actions',
      hardStopMode: 'FreezeRun',
      evaluatedUsage: 5,
      threshold: 5,
    });
    expect(result.evidence.stopClass).toBe('budget');
  });

  it('gives kill-switch controls precedence over budget warnings', () => {
    const result = evaluateAutonomyBudgetsV1({
      policies: [
        makePolicy({
          autonomyBudgets: [
            {
              budgetId: 'workspace-model-spend',
              scope: 'Workspace',
              metric: 'ModelSpendCents',
              warningAt: 8_000,
              hardStopAt: 10_000,
              hardStopMode: 'FreezeWorkspace',
              rationale: 'Pilot spend cap.',
            },
          ],
        }),
      ],
      context: makeContext({
        workspaceKillSwitch: true,
        usage: [{ scope: 'Workspace', metric: 'ModelSpendCents', used: 8_500 }],
      }),
    });

    expect(result.decision).toBe('HardStop');
    expect(result.hardStops[0]?.kind).toBe('WorkspaceKillSwitch');
    expect(result.warnings[0]?.kind).toBe('BudgetWarning');
    expect(result.evidence.stopClass).toBe('policy-control');
  });

  it('records runaway hard-stop rationale for operator evidence', () => {
    const result = evaluateAutonomyBudgetsV1({
      policies: [],
      context: makeContext({
        runawayDetected: true,
        runawayRationale: 'Tool-call velocity exceeded the reviewed autonomy envelope.',
      }),
    });

    expect(result.decision).toBe('HardStop');
    expect(result.hardStops[0]).toMatchObject({
      kind: 'RunawayHardStop',
      hardStopMode: 'KillRun',
    });
    expect(result.operatorVisibleRationale).toContain('Tool-call velocity');
    expect(result.evidence.stopClass).toBe('runaway');
  });
});
