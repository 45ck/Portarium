import { describe, expect, it } from 'vitest';

import {
  evaluateToolExposure,
  filterAllowedTools,
  type ToolExposurePolicyV1,
} from './tool-exposure-policy-v1.js';

const ALL_TOOLS = [
  'portarium_run_start',
  'portarium_run_get',
  'portarium_run_cancel',
  'portarium_work_items_list',
  'portarium_approval_submit',
  'portarium_agent_register',
  'portarium_agent_heartbeat',
];

function makePolicy(overrides?: Partial<ToolExposurePolicyV1>): ToolExposurePolicyV1 {
  return {
    schemaVersion: 1,
    workspaceId: 'ws-1',
    rules: [],
    defaultEffect: 'Allow',
    ...overrides,
  };
}

describe('evaluateToolExposure', () => {
  it('allows when default is Allow and no rules match', () => {
    const result = evaluateToolExposure({
      policy: makePolicy({ defaultEffect: 'Allow' }),
      toolName: 'portarium_run_get',
      callerRole: 'operator',
      executionTier: 'Auto',
    });
    expect(result.decision).toBe('Allow');
  });

  it('denies when default is Deny and no rules match', () => {
    const result = evaluateToolExposure({
      policy: makePolicy({ defaultEffect: 'Deny' }),
      toolName: 'portarium_run_get',
      callerRole: 'operator',
      executionTier: 'Auto',
    });
    expect(result.decision).toBe('Deny');
  });

  it('allows tool when role and tier match rule', () => {
    const result = evaluateToolExposure({
      policy: makePolicy({
        rules: [
          {
            toolPattern: 'portarium_run_start',
            allowedRoles: ['admin', 'operator'],
            minimumTier: 'Auto',
          },
        ],
      }),
      toolName: 'portarium_run_start',
      callerRole: 'operator',
      executionTier: 'Auto',
    });
    expect(result.decision).toBe('Allow');
  });

  it('denies when caller role is not in allowed roles', () => {
    const result = evaluateToolExposure({
      policy: makePolicy({
        rules: [
          {
            toolPattern: 'portarium_approval_submit',
            allowedRoles: ['admin', 'approver'],
            minimumTier: 'Auto',
          },
        ],
      }),
      toolName: 'portarium_approval_submit',
      callerRole: 'auditor',
      executionTier: 'HumanApprove',
    });
    expect(result.decision).toBe('Deny');
    expect(result.reason).toContain('auditor');
  });

  it('denies when execution tier is below minimum', () => {
    const result = evaluateToolExposure({
      policy: makePolicy({
        rules: [
          {
            toolPattern: 'portarium_run_cancel',
            allowedRoles: [],
            minimumTier: 'HumanApprove',
          },
        ],
      }),
      toolName: 'portarium_run_cancel',
      callerRole: 'admin',
      executionTier: 'Auto',
    });
    expect(result.decision).toBe('Deny');
    expect(result.reason).toContain('HumanApprove');
  });

  it('matches wildcard patterns', () => {
    const result = evaluateToolExposure({
      policy: makePolicy({
        rules: [
          {
            toolPattern: 'portarium_run_*',
            allowedRoles: [],
            minimumTier: 'Auto',
          },
        ],
      }),
      toolName: 'portarium_run_get',
      callerRole: 'operator',
      executionTier: 'Auto',
    });
    expect(result.decision).toBe('Allow');
  });

  it('matches catch-all * pattern', () => {
    const result = evaluateToolExposure({
      policy: makePolicy({
        defaultEffect: 'Deny',
        rules: [
          {
            toolPattern: '*',
            allowedRoles: ['admin'],
            minimumTier: 'Auto',
          },
        ],
      }),
      toolName: 'anything',
      callerRole: 'admin',
      executionTier: 'Auto',
    });
    expect(result.decision).toBe('Allow');
  });

  it('uses first matching rule (order matters)', () => {
    const result = evaluateToolExposure({
      policy: makePolicy({
        rules: [
          {
            toolPattern: 'portarium_run_start',
            allowedRoles: ['admin'],
            minimumTier: 'HumanApprove',
          },
          {
            toolPattern: 'portarium_run_*',
            allowedRoles: [],
            minimumTier: 'Auto',
          },
        ],
      }),
      toolName: 'portarium_run_start',
      callerRole: 'operator',
      executionTier: 'Auto',
    });
    // First rule matches, operator not in allowedRoles
    expect(result.decision).toBe('Deny');
  });
});

describe('filterAllowedTools', () => {
  it('filters tools based on policy', () => {
    const allowed = filterAllowedTools({
      policy: makePolicy({
        defaultEffect: 'Deny',
        rules: [
          {
            toolPattern: 'portarium_run_*',
            allowedRoles: [],
            minimumTier: 'Auto',
          },
          {
            toolPattern: 'portarium_work_items_list',
            allowedRoles: [],
            minimumTier: 'Auto',
          },
        ],
      }),
      allToolNames: ALL_TOOLS,
      callerRole: 'operator',
      executionTier: 'Auto',
    });

    expect(allowed).toEqual([
      'portarium_run_start',
      'portarium_run_get',
      'portarium_run_cancel',
      'portarium_work_items_list',
    ]);
  });

  it('returns all tools when default is Allow and no deny rules', () => {
    const allowed = filterAllowedTools({
      policy: makePolicy({ defaultEffect: 'Allow', rules: [] }),
      allToolNames: ALL_TOOLS,
      callerRole: 'operator',
      executionTier: 'Auto',
    });
    expect(allowed).toEqual(ALL_TOOLS);
  });

  it('returns empty when default is Deny and no allow rules', () => {
    const allowed = filterAllowedTools({
      policy: makePolicy({ defaultEffect: 'Deny', rules: [] }),
      allToolNames: ALL_TOOLS,
      callerRole: 'operator',
      executionTier: 'Auto',
    });
    expect(allowed).toEqual([]);
  });
});
