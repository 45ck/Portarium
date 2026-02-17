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
          operation: 'secret:read',
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

  it('supports canonical capability while retaining legacy operation support', () => {
    const wf = parseWorkflowV1({
      schemaVersion: 1,
      workflowId: 'wf-3',
      workspaceId: 'ws-1',
      name: 'Canonical path',
      version: 1,
      active: true,
      executionTier: 'Auto',
      actions: [
        {
          actionId: 'act-1',
          order: 1,
          portFamily: 'SecretsVaulting',
          capability: 'secret:read',
        },
      ],
    });

    expect(wf.actions[0]?.capability).toBe('secret:read');
    expect(wf.actions[0]?.operation).toBe('secret:read');
  });

  it('rejects legacy operation values that do not match capability format', () => {
    expect(() =>
      parseWorkflowV1({
        schemaVersion: 1,
        workflowId: 'wf-4',
        workspaceId: 'ws-1',
        name: 'Bad legacy op',
        version: 1,
        active: true,
        executionTier: 'Auto',
        actions: [
          {
            actionId: 'act-1',
            order: 1,
            portFamily: 'SecretsVaulting',
            operation: 'readKvV2Secret',
          },
        ],
      }),
    ).toThrow(/must match \"entity:verb\" format when capability is not provided/);
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

  it('rejects capability values that are not valid for the port family', () => {
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
          {
            actionId: 'act-1',
            order: 1,
            portFamily: 'SecretsVaulting',
            capability: 'invoice:read',
          },
        ],
      }),
    ).toThrow(/not supported/);
  });

  it('rejects mismatched capability and operation fields when both are provided', () => {
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
          {
            actionId: 'act-1',
            order: 1,
            portFamily: 'SecretsVaulting',
            capability: 'secret:read',
            operation: 'secret:write',
          },
        ],
      }),
    ).toThrow(/operation must match capability when both are provided/);
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
