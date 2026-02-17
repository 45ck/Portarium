import { describe, expect, it } from 'vitest';

import { parsePackWorkflowDefinitionV1 } from './pack-workflow-definition-v1.js';

const VALID_WORKFLOW_DEFINITION = {
  schemaVersion: 1,
  definitionId: 'wf-001',
  packId: 'scm.change-management',
  namespace: 'scm',
  steps: [
    { stepId: 'step-1', name: 'Create PR', actionType: 'createPullRequest' },
    { stepId: 'step-2', name: 'Run Tests', actionType: 'triggerCi' },
  ],
  triggerType: 'webhook',
  executionTier: 'Assisted',
};

describe('parsePackWorkflowDefinitionV1: happy path', () => {
  it('parses a valid v1 workflow definition', () => {
    const wf = parsePackWorkflowDefinitionV1(VALID_WORKFLOW_DEFINITION);

    expect(wf.schemaVersion).toBe(1);
    expect(wf.definitionId).toBe('wf-001');
    expect(wf.packId).toBe('scm.change-management');
    expect(wf.namespace).toBe('scm');
    expect(wf.triggerType).toBe('webhook');
    expect(wf.executionTier).toBe('Assisted');
    expect(wf.steps).toHaveLength(2);
    expect(wf.steps[0]!.stepId).toBe('step-1');
    expect(wf.steps[1]!.actionType).toBe('triggerCi');
  });
});

describe('parsePackWorkflowDefinitionV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parsePackWorkflowDefinitionV1(null)).toThrow(/must be an object/);
    expect(() => parsePackWorkflowDefinitionV1([])).toThrow(/must be an object/);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() =>
      parsePackWorkflowDefinitionV1({ ...VALID_WORKFLOW_DEFINITION, schemaVersion: 2 }),
    ).toThrow(/Unsupported schemaVersion/);
  });

  it('rejects invalid executionTier', () => {
    expect(() =>
      parsePackWorkflowDefinitionV1({ ...VALID_WORKFLOW_DEFINITION, executionTier: 'SuperFast' }),
    ).toThrow(/Invalid executionTier/);
  });

  it('rejects non-array steps', () => {
    expect(() =>
      parsePackWorkflowDefinitionV1({ ...VALID_WORKFLOW_DEFINITION, steps: 'oops' }),
    ).toThrow(/steps must be an array/);
  });

  it('rejects non-object step entry', () => {
    expect(() =>
      parsePackWorkflowDefinitionV1({ ...VALID_WORKFLOW_DEFINITION, steps: [42] }),
    ).toThrow(/steps\[0\] must be an object/);
  });

  it('rejects missing required string fields', () => {
    expect(() =>
      parsePackWorkflowDefinitionV1({ ...VALID_WORKFLOW_DEFINITION, definitionId: '' }),
    ).toThrow(/definitionId must be a non-empty string/);

    expect(() =>
      parsePackWorkflowDefinitionV1({ ...VALID_WORKFLOW_DEFINITION, triggerType: 123 }),
    ).toThrow(/triggerType must be a non-empty string/);
  });

  it('rejects non-integer schemaVersion', () => {
    expect(() =>
      parsePackWorkflowDefinitionV1({ ...VALID_WORKFLOW_DEFINITION, schemaVersion: 1.5 }),
    ).toThrow(/schemaVersion must be an integer/);
  });
});
