import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import { mustRecord, readText, resolveRepoRoot } from './openapi-contract.test-helpers.js';

const WORKFLOW_RELATIVE_PATH = '.github/workflows/openapi-operation-ids.yml';

describe('OpenAPI operationId CI workflow', () => {
  it('runs on both push and pull_request events', async () => {
    const workflow = await loadWorkflow();

    const triggers = readWorkflowTriggers(workflow);
    expect(triggers).toHaveProperty('push');
    expect(triggers).toHaveProperty('pull_request');
  });

  it('executes openapi operationId parity check command', async () => {
    const workflow = await loadWorkflow();

    const jobs = mustRecord(workflow['jobs'], 'workflow.jobs');
    const gateJob = mustRecord(jobs['openapi_operation_ids'], 'workflow.jobs.openapi_operation_ids');

    const steps = gateJob['steps'];
    if (!Array.isArray(steps)) {
      throw new Error('workflow.jobs.openapi_operation_ids.steps must be an array.');
    }

    const hasParityStep = steps.some((step) => {
      if (!isRecord(step)) return false;
      return step['run'] === 'npm run openapi:operation-ids:check';
    });
    expect(hasParityStep).toBe(true);
  });
});

async function loadWorkflow(): Promise<Record<string, unknown>> {
  const repoRoot = resolveRepoRoot();
  const workflowPath = path.join(repoRoot, WORKFLOW_RELATIVE_PATH);
  const parsed = parseYaml(await readText(workflowPath)) as unknown;
  return mustRecord(parsed, 'workflow');
}

function readWorkflowTriggers(workflow: Record<string, unknown>): Record<string, unknown> {
  const triggersRaw = workflow['on'] ?? workflow['true'];
  return mustRecord(triggersRaw, 'workflow.on');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
