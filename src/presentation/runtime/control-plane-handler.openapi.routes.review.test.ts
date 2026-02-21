import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import { ok } from '../../application/common/result.js';
import { toAppContext } from '../../application/common/context.js';

type OpenApiParameter = Readonly<{
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  schema?: Record<string, unknown>;
}>;

type OpenApiOperation = Readonly<{
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  pathTemplate: string;
  operationId: string;
  allowedStatuses: ReadonlySet<number>;
  hasDefaultResponse: boolean;
  parameters: readonly OpenApiParameter[];
  hasJsonRequestBody: boolean;
}>;

const OPENAPI_SPEC_RELATIVE_PATH = 'docs/spec/openapi/portarium-control-plane.v1.yaml';
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

let handle: HealthServerHandle | undefined;

beforeAll(async () => {
  const ctx = toAppContext({
    tenantId: 'workspace-1',
    principalId: 'user-1',
    roles: ['admin', 'operator', 'approver', 'auditor'],
    correlationId: 'corr-openapi-routes-review',
  });

  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler({
      authentication: {
        authenticateBearerToken: async () => ok(ctx),
      },
      authorization: {
        isAllowed: async () => true,
      },
      workspaceStore: {
        getWorkspaceById: async () => null,
        getWorkspaceByName: async () => null,
        saveWorkspace: async () => undefined,
      },
      runStore: {
        getRunById: async () => null,
        saveRun: async () => undefined,
      },
    }),
  });
});

afterAll(async () => {
  await handle?.close();
  handle = undefined;
});

describe('control-plane handler OpenAPI route review coverage', () => {
  it('every OpenAPI operation resolves to a documented status and uses problem+json on errors', async () => {
    if (!handle) throw new Error('Expected test server handle to be initialized.');

    const operations = await loadOpenApiOperations();
    expect(operations.length).toBeGreaterThan(0);

    for (const operation of operations) {
      const { urlPath, requestInit } = buildRequest(operation);
      const res = await fetch(`http://${handle.host}:${handle.port}${urlPath}`, requestInit);

      const statusIsDocumented =
        operation.allowedStatuses.has(res.status) || operation.hasDefaultResponse;
      if (!statusIsDocumented) {
        throw new Error(
          `${operation.operationId} (${operation.method} ${operation.pathTemplate}) returned undocumented status ${res.status}.`,
        );
      }

      if (res.status >= 400) {
        const contentType = res.headers.get('content-type') ?? '';
        expect(contentType).toMatch(/application\/problem\+json/i);
      }

      await res.arrayBuffer();
    }
  });
});

async function loadOpenApiOperations(): Promise<readonly OpenApiOperation[]> {
  const specPath = path.join(process.cwd(), OPENAPI_SPEC_RELATIVE_PATH);
  const raw = await readFile(specPath, 'utf8');
  const doc = toRecord(parseYaml(raw), 'OpenAPI document');
  const paths = toRecord(doc['paths'], 'OpenAPI.paths');
  const components = toRecord(doc['components'], 'OpenAPI.components');
  const componentParameters = toRecord(
    components['parameters'] ?? {},
    'OpenAPI.components.parameters',
  );

  const operations: OpenApiOperation[] = [];
  for (const [pathTemplate, pathItemUnknown] of Object.entries(paths)) {
    const pathItem = toRecord(pathItemUnknown, `OpenAPI.paths.${pathTemplate}`);
    operations.push(...extractPathOperations(pathTemplate, pathItem, doc, componentParameters));
  }

  return operations;
}

function extractPathOperations(
  pathTemplate: string,
  pathItem: Record<string, unknown>,
  rootDoc: Record<string, unknown>,
  componentParameters: Record<string, unknown>,
): readonly OpenApiOperation[] {
  const pathParameters = readParameters(pathItem['parameters'], rootDoc, componentParameters);
  const operations: OpenApiOperation[] = [];
  for (const method of HTTP_METHODS) {
    const operationUnknown = pathItem[method];
    if (!operationUnknown) continue;
    const operation = toRecord(operationUnknown, `${pathTemplate}.${method}`);
    operations.push(
      buildOpenApiOperation({
        method,
        pathTemplate,
        operation,
        pathParameters,
        rootDoc,
        componentParameters,
      }),
    );
  }
  return operations;
}

function buildOpenApiOperation(
  input: Readonly<{
    method: (typeof HTTP_METHODS)[number];
    pathTemplate: string;
    operation: Record<string, unknown>;
    pathParameters: readonly OpenApiParameter[];
    rootDoc: Record<string, unknown>;
    componentParameters: Record<string, unknown>;
  }>,
): OpenApiOperation {
  const operationParameters = readParameters(
    input.operation['parameters'],
    input.rootDoc,
    input.componentParameters,
  );
  const responses = toRecord(
    input.operation['responses'],
    `${input.pathTemplate}.${input.method}.responses`,
  );
  const { allowedStatuses, hasDefaultResponse } = readAllowedStatuses(responses);
  return {
    method: input.method.toUpperCase() as OpenApiOperation['method'],
    pathTemplate: input.pathTemplate,
    operationId:
      typeof input.operation['operationId'] === 'string'
        ? input.operation['operationId']
        : `${input.method.toUpperCase()} ${input.pathTemplate}`,
    allowedStatuses,
    hasDefaultResponse,
    parameters: [...input.pathParameters, ...operationParameters],
    hasJsonRequestBody: hasJsonRequestBody(input.operation, input.rootDoc),
  };
}

function readAllowedStatuses(
  responses: Record<string, unknown>,
): Readonly<{ allowedStatuses: ReadonlySet<number>; hasDefaultResponse: boolean }> {
  const allowedStatuses = new Set<number>();
  let hasDefaultResponse = false;
  for (const key of Object.keys(responses)) {
    if (/^\d{3}$/.test(key)) {
      allowedStatuses.add(Number.parseInt(key, 10));
      continue;
    }
    if (key === 'default') hasDefaultResponse = true;
  }
  return { allowedStatuses, hasDefaultResponse };
}

function buildRequest(operation: OpenApiOperation): {
  urlPath: string;
  requestInit: RequestInit;
} {
  let resolvedPath = operation.pathTemplate;
  const query = new URLSearchParams();
  const headers = new Headers();

  for (const param of operation.parameters) {
    const value = sampleParameterValue(param);
    if (param.in === 'path') {
      resolvedPath = resolvedPath.replace(`{${param.name}}`, encodeURIComponent(value));
      continue;
    }
    if (param.in === 'query' && param.required) {
      query.set(param.name, value);
      continue;
    }
    if (param.in === 'header' && param.required) {
      headers.set(param.name, value);
    }
  }

  let body: string | undefined;
  if (operation.hasJsonRequestBody) {
    headers.set('content-type', 'application/json');
    body = '{}';
  }

  const queryText = query.toString();
  const urlPath = queryText === '' ? resolvedPath : `${resolvedPath}?${queryText}`;
  return {
    urlPath,
    requestInit: {
      method: operation.method,
      headers,
      ...(body ? { body } : {}),
    },
  };
}

function hasJsonRequestBody(
  operation: Record<string, unknown>,
  rootDoc: Record<string, unknown>,
): boolean {
  const requestBody = resolveMaybeRef(operation['requestBody'], rootDoc);
  if (!requestBody) return false;
  const content = toRecord(requestBody['content'] ?? {}, 'requestBody.content');
  return Object.prototype.hasOwnProperty.call(content, 'application/json');
}

function readParameters(
  value: unknown,
  rootDoc: Record<string, unknown>,
  componentParameters: Record<string, unknown>,
): readonly OpenApiParameter[] {
  if (!Array.isArray(value)) return [];

  const parameters: OpenApiParameter[] = [];
  for (const item of value) {
    const resolved = resolveMaybeRef(item, rootDoc, componentParameters);
    if (!resolved) continue;
    const parameter = toOpenApiParameter(resolved);
    if (parameter) parameters.push(parameter);
  }

  return parameters;
}

function toOpenApiParameter(resolved: Record<string, unknown>): OpenApiParameter | null {
  const name = typeof resolved['name'] === 'string' ? resolved['name'] : undefined;
  const location = parseParameterLocation(resolved['in']);
  if (!name || !location) return null;
  return {
    name,
    in: location,
    required: resolved['required'] === true,
    ...(isRecord(resolved['schema']) ? { schema: resolved['schema'] } : {}),
  };
}

function parseParameterLocation(value: unknown): OpenApiParameter['in'] | null {
  return value === 'path' || value === 'query' || value === 'header' || value === 'cookie'
    ? value
    : null;
}

function resolveMaybeRef(
  value: unknown,
  rootDoc: Record<string, unknown>,
  componentParameters?: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;

  const ref = value['$ref'];
  if (typeof ref !== 'string') return value;
  if (!ref.startsWith('#/')) return null;

  const componentRef = resolveComponentParameterRef(ref, componentParameters);
  if (componentRef) return componentRef;
  return resolveJsonPointerRef(ref, rootDoc);
}

function resolveComponentParameterRef(
  ref: string,
  componentParameters: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!componentParameters || !ref.startsWith('#/components/parameters/')) return null;
  const key = ref.split('/').at(-1);
  if (typeof key !== 'string') return null;
  const candidate = componentParameters[key];
  return isRecord(candidate) ? candidate : null;
}

function resolveJsonPointerRef(
  ref: string,
  rootDoc: Record<string, unknown>,
): Record<string, unknown> | null {
  const pointerTokens = ref
    .slice(2)
    .split('/')
    .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current: unknown = rootDoc;
  for (const token of pointerTokens) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, token)) {
      return null;
    }
    current = current[token];
  }
  return isRecord(current) ? current : null;
}

function sampleParameterValue(parameter: OpenApiParameter): string {
  const byName = byKnownParameterName(parameter.name);
  if (byName) return byName;

  const bySchema = byParameterSchema(parameter.schema ?? {});
  if (bySchema) return bySchema;

  const byHint = byParameterNameHint(parameter.name);
  if (byHint) return byHint;

  return `${parameter.name}-1`;
}

function byKnownParameterName(name: string): string | undefined {
  const byName: Record<string, string> = {
    workspaceId: 'workspace-1',
    userId: 'user-1',
    workItemId: 'work-item-1',
    workflowId: 'workflow-1',
    runId: 'run-1',
    approvalId: 'approval-1',
    evidenceId: 'evidence-1',
    adapterId: 'adapter-1',
    credentialGrantId: 'credential-grant-1',
    policyId: 'policy-1',
    planId: 'plan-1',
    workforceMemberId: 'wm-1',
    queueId: 'queue-1',
    humanTaskId: 'ht-1',
    machineId: 'machine-1',
    agentId: 'agent-1',
    mapLayerId: 'map-layer-1',
    locationEventId: 'loc-1',
  };
  return Object.prototype.hasOwnProperty.call(byName, name) ? byName[name] : undefined;
}

function byParameterSchema(schema: Record<string, unknown>): string | undefined {
  const enumValues = schema['enum'];
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    const first = enumValues[0];
    if (typeof first === 'string' || typeof first === 'number' || typeof first === 'boolean') {
      return String(first);
    }
  }
  if (schema['type'] === 'integer' || schema['type'] === 'number') return '1';
  if (schema['type'] === 'boolean') return 'true';
  return undefined;
}

function byParameterNameHint(name: string): string | undefined {
  const normalized = name.toLowerCase();
  if (normalized.includes('iso') || normalized.includes('from')) return '2026-02-20T10:00:00.000Z';
  if (normalized.includes('to')) return '2026-02-20T10:10:00.000Z';
  if (normalized.includes('limit')) return '1';
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}
