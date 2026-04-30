import path from 'node:path';

import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import {
  buildJsonSchemaFromComponents,
  mustRecord,
  readText,
  resolveRepoRoot,
  validateOrThrow,
} from './openapi-contract.test-helpers.js';

const OPENAPI_SPEC_RELATIVE_PATH = 'docs/spec/openapi/portarium-control-plane.v1.yaml';

type OpenApiOperation = Readonly<{
  operationId: string;
  responses: Record<string, unknown>;
  requestBody?: Record<string, unknown>;
}>;

describe('OpenAPI command endpoint parity', () => {
  it('documents the Cockpit run and approval command endpoints with stable operations', async () => {
    const paths = await loadOpenApiPaths();

    const startRun = getOperation(paths, '/v1/workspaces/{workspaceId}/runs', 'post');
    const cancelRun = getOperation(
      paths,
      '/v1/workspaces/{workspaceId}/runs/{runId}/cancel',
      'post',
    );
    const createApproval = getOperation(paths, '/v1/workspaces/{workspaceId}/approvals', 'post');

    expect(startRun.operationId).toBe('startRun');
    expect(createApproval.operationId).toBe('createApproval');
    expect(cancelRun.operationId).toBe('cancelRun');

    expect(Object.prototype.hasOwnProperty.call(startRun.responses, '201')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(createApproval.responses, '201')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(cancelRun.responses, '200')).toBe(true);

    expect(startRun.requestBody).toBeDefined();
    expect(createApproval.requestBody).toBeDefined();
    expect(cancelRun.requestBody).toBeUndefined();
  });

  it('validates representative request and response payloads for the three command endpoints', async () => {
    const schemas = await loadComponentSchemas();
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats.default(ajv);

    const validateStartRunRequest = ajv.compile(
      buildJsonSchemaFromComponents({ rootName: 'StartRunRequest', componentsSchemas: schemas }),
    );
    const validateCreateApprovalRequest = ajv.compile(
      buildJsonSchemaFromComponents({
        rootName: 'CreateApprovalRequest',
        componentsSchemas: schemas,
      }),
    );
    const validateRun = ajv.compile(
      buildJsonSchemaFromComponents({ rootName: 'RunV1', componentsSchemas: schemas }),
    );
    const validateApproval = ajv.compile(
      buildJsonSchemaFromComponents({ rootName: 'ApprovalV1', componentsSchemas: schemas }),
    );

    const startRunRequest = {
      workflowId: 'workflow-1',
      parameters: {
        ticketId: 'INC-42',
        priority: 'high',
      },
    };
    const createApprovalRequest = {
      runId: 'run-1',
      planId: 'plan-1',
      workItemId: 'work-item-1',
      prompt: 'Approve the governed change request.',
      assigneeUserId: 'approver-1',
      dueAtIso: '2026-05-01T00:00:00.000Z',
    };
    const runResponse = {
      schemaVersion: 1,
      runId: 'run-1',
      workspaceId: 'workspace-1',
      workflowId: 'workflow-1',
      correlationId: 'corr-run-1',
      executionTier: 'HumanApprove',
      initiatedByUserId: 'user-1',
      status: 'Running',
      createdAtIso: '2026-04-30T00:00:00.000Z',
    };
    const approvalResponse = {
      schemaVersion: 1,
      approvalId: 'approval-1',
      workspaceId: 'workspace-1',
      runId: 'run-1',
      planId: 'plan-1',
      workItemId: 'work-item-1',
      prompt: 'Approve the governed change request.',
      status: 'Pending',
      requestedAtIso: '2026-04-30T00:00:00.000Z',
      requestedByUserId: 'user-1',
      assigneeUserId: 'approver-1',
      dueAtIso: '2026-05-01T00:00:00.000Z',
    };

    expect(() => validateOrThrow(validateStartRunRequest, startRunRequest)).not.toThrow();
    expect(() =>
      validateOrThrow(validateCreateApprovalRequest, createApprovalRequest),
    ).not.toThrow();
    expect(() => validateOrThrow(validateRun, runResponse)).not.toThrow();
    expect(() => validateOrThrow(validateApproval, approvalResponse)).not.toThrow();
  });

  it('keeps the shared ops-cockpit client aligned with the documented command endpoints', async () => {
    const schemas = await loadComponentSchemas();
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats.default(ajv);

    const validateStartRunRequest = ajv.compile(
      buildJsonSchemaFromComponents({ rootName: 'StartRunRequest', componentsSchemas: schemas }),
    );
    const validateCreateApprovalRequest = ajv.compile(
      buildJsonSchemaFromComponents({
        rootName: 'CreateApprovalRequest',
        componentsSchemas: schemas,
      }),
    );

    const clientText = await readText(
      path.join(resolveRepoRoot(), 'src/presentation/ops-cockpit/http-client.ts'),
    );
    const startRunBlock = extractClientMethodBlock(clientText, 'startRun');
    const cancelRunBlock = extractClientMethodBlock(clientText, 'cancelRun');
    const createApprovalBlock = extractClientMethodBlock(clientText, 'createApproval');

    expect(startRunBlock).toContain('/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs');
    expect(startRunBlock).toContain("'POST'");
    expect(startRunBlock).toContain('idempotencyKey');

    expect(cancelRunBlock).toContain(
      '/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs/${normalizeResourceId(runId)}/cancel',
    );
    expect(cancelRunBlock).toContain("'POST'");

    expect(createApprovalBlock).toContain(
      '/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/approvals',
    );
    expect(createApprovalBlock).toContain("'POST'");
    expect(createApprovalBlock).toContain('idempotencyKey');

    expect(() =>
      validateOrThrow(validateStartRunRequest, {
        workflowId: 'workflow-1',
        parameters: { ticketId: 'INC-42' },
      }),
    ).not.toThrow();
    expect(() =>
      validateOrThrow(validateCreateApprovalRequest, {
        runId: 'run-1',
        planId: 'plan-1',
        prompt: 'Approve the governed change request.',
      }),
    ).not.toThrow();
  });
});

async function loadOpenApiPaths(): Promise<Record<string, unknown>> {
  const repoRoot = resolveRepoRoot();
  const specPath = path.join(repoRoot, OPENAPI_SPEC_RELATIVE_PATH);
  const doc = mustRecord(parseYaml(await readText(specPath)), 'OpenAPI');
  return mustRecord(doc['paths'], 'OpenAPI.paths');
}

async function loadComponentSchemas(): Promise<Record<string, unknown>> {
  const repoRoot = resolveRepoRoot();
  const specPath = path.join(repoRoot, OPENAPI_SPEC_RELATIVE_PATH);
  const doc = mustRecord(parseYaml(await readText(specPath)), 'OpenAPI');
  const components = mustRecord(doc['components'], 'OpenAPI.components');
  return mustRecord(components['schemas'], 'OpenAPI.components.schemas');
}

function getOperation(
  paths: Record<string, unknown>,
  pathTemplate: string,
  method: 'post',
): OpenApiOperation {
  const pathItem = mustRecord(paths[pathTemplate], `OpenAPI.paths.${pathTemplate}`);
  const operation = mustRecord(pathItem[method], `OpenAPI.paths.${pathTemplate}.${method}`);

  return {
    operationId:
      typeof operation['operationId'] === 'string' ? operation['operationId'] : '<missing>',
    responses: mustRecord(
      operation['responses'],
      `OpenAPI.paths.${pathTemplate}.${method}.responses`,
    ),
    ...(operation['requestBody']
      ? {
          requestBody: mustRecord(
            operation['requestBody'],
            `OpenAPI.paths.${pathTemplate}.${method}.requestBody`,
          ),
        }
      : {}),
  };
}

function extractClientMethodBlock(sourceText: string, methodName: string): string {
  const methodStart = sourceText.indexOf(`public ${methodName}(`);
  if (methodStart === -1) {
    throw new Error(`ControlPlaneClient.${methodName} not found.`);
  }
  const nextMethod = sourceText.indexOf('\n  public ', methodStart + 1);
  const requestMethod = sourceText.indexOf('\n  protected ', methodStart + 1);
  const methodEnd =
    [nextMethod, requestMethod].filter((index) => index !== -1).sort((a, b) => a - b)[0] ??
    sourceText.length;
  return sourceText.slice(methodStart, methodEnd);
}
