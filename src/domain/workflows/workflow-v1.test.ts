import { describe, expect, it } from 'vitest';

import { parseWorkflowV1 } from './workflow-v1.js';

describe('parseWorkflowV1: happy path', () => {
  it('parses a minimal workflow with a single action', () => {
    const wf = parseWorkflowV1({
      schemaVersion: 1,
      workflowId: 'wf-1',
      workspaceId: 'ws-1',
      name: 'Invoice correction',
      version: 1,
      active: true,
      executionTier: 'Assisted',
      actions: [
        {
          actionId: 'act-1',
          order: 1,
          portFamily: 'SecretsVaulting',
          operation: 'readKvV2Secret',
        },
      ],
    });

    expect(wf.schemaVersion).toBe(1);
    expect(wf.actions).toHaveLength(1);
    expect(wf.actions[0]?.order).toBe(1);
  });

  it('allows action-level tier overrides that are stricter than the workflow tier', () => {
    const wf = parseWorkflowV1({
      schemaVersion: 1,
      workflowId: 'wf-2',
      workspaceId: 'ws-1',
      name: 'High risk change',
      version: 3,
      active: false,
      executionTier: 'Auto',
      actions: [
        {
          actionId: 'act-1',
          order: 1,
          portFamily: 'SecretsVaulting',
          operation: 'mount',
          executionTierOverride: 'HumanApprove',
        },
      ],
    });

    expect(wf.executionTier).toBe('Auto');
    expect(wf.actions[0]?.executionTierOverride).toBe('HumanApprove');
  });
});

describe('parseWorkflowV1: validation', () => {
  it('rejects invalid top-level inputs and schema versions', () => {
    expect(() => parseWorkflowV1('nope')).toThrow(/Workflow must be an object/i);
    expect(() => parseWorkflowV1({ schemaVersion: 2 })).toThrow(/schemaVersion/i);
  });

  it('requires a non-empty actions array', () => {
    expect(() =>
      parseWorkflowV1({
        schemaVersion: 1,
        workflowId: 'wf-1',
        workspaceId: 'ws-1',
        name: 'x',
        version: 1,
        active: true,
        executionTier: 'Auto',
        actions: [],
      }),
    ).toThrow(/actions must be a non-empty array/i);
  });

  it('rejects invalid PortFamily', () => {
    expect(() =>
      parseWorkflowV1({
        schemaVersion: 1,
        workflowId: 'wf-1',
        workspaceId: 'ws-1',
        name: 'x',
        version: 1,
        active: true,
        executionTier: 'Auto',
        actions: [{ actionId: 'act-1', order: 1, portFamily: 'NotARealFamily', operation: 'op' }],
      }),
    ).toThrow(/portFamily/i);
  });

  it('rejects non-contiguous or unordered action sequences', () => {
    expect(() =>
      parseWorkflowV1({
        schemaVersion: 1,
        workflowId: 'wf-1',
        workspaceId: 'ws-1',
        name: 'x',
        version: 1,
        active: true,
        executionTier: 'Auto',
        actions: [
          { actionId: 'act-1', order: 2, portFamily: 'SecretsVaulting', operation: 'op' },
          { actionId: 'act-2', order: 1, portFamily: 'SecretsVaulting', operation: 'op' },
        ],
      }),
    ).toThrow(/contiguous/i);
  });

  it('rejects action tier overrides that are less strict than the workflow tier', () => {
    expect(() =>
      parseWorkflowV1({
        schemaVersion: 1,
        workflowId: 'wf-1',
        workspaceId: 'ws-1',
        name: 'x',
        version: 1,
        active: true,
        executionTier: 'HumanApprove',
        actions: [
          {
            actionId: 'act-1',
            order: 1,
            portFamily: 'SecretsVaulting',
            operation: 'op',
            executionTierOverride: 'Auto',
          },
        ],
      }),
    ).toThrow(/less strict/i);
  });
});
