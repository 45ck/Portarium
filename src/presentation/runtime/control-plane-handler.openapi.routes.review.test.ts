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
    const pathParameters = readParameters(pathItem['parameters'], doc, componentParameters);

    for (const method of HTTP_METHODS) {
      const operationUnknown = pathItem[method];
      if (!operationUnknown) continue;

      const operation = toRecord(operationUnknown, `${pathTemplate}.${method}`);
      const operationParameters = readParameters(operation['parameters'], doc, componentParameters);
      const responses = toRecord(operation['responses'], `${pathTemplate}.${method}.responses`);

      const allowedStatuses = new Set<number>();
      let hasDefaultResponse = false;
      for (const key of Object.keys(responses)) {
        if (/^\d{3}$/.test(key)) {
          allowedStatuses.add(Number.parseInt(key, 10));
        } else if (key === 'default') {
          hasDefaultResponse = true;
        }
      }

      const operationId =
        typeof operation['operationId'] === 'string'
          ? operation['operationId']
          : `${method.toUpperCase()} ${pathTemplate}`;

      operations.push({
        method: method.toUpperCase() as OpenApiOperation['method'],
        pathTemplate,
        operationId,
        allowedStatuses,
        hasDefaultResponse,
        parameters: [...pathParameters, ...operationParameters],
        hasJsonRequestBody: hasJsonRequestBody(operation, doc),
      });
    }
  }

  return operations;
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

    const name = typeof resolved['name'] === 'string' ? resolved['name'] : undefined;
    const location = resolved['in'];
    if (
      !name ||
      (location !== 'path' &&
        location !== 'query' &&
        location !== 'header' &&
        location !== 'cookie')
    ) {
      continue;
    }

    parameters.push({
      name,
      in: location,
      required: resolved['required'] === true,
      ...(isRecord(resolved['schema']) ? { schema: resolved['schema'] } : {}),
    });
  }

  return parameters;
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

  if (componentParameters && ref.startsWith('#/components/parameters/')) {
    const key = ref.split('/').at(-1);
    if (typeof key !== 'string') return null;
    const candidate = componentParameters[key];
    return isRecord(candidate) ? candidate : null;
  }

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
  if (Object.prototype.hasOwnProperty.call(byName, parameter.name)) {
    return byName[parameter.name]!;
  }

  const schema = parameter.schema ?? {};
  const enumValues = schema['enum'];
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    const first = enumValues[0];
    if (typeof first === 'string' || typeof first === 'number' || typeof first === 'boolean') {
      return String(first);
    }
  }

  if (schema['type'] === 'integer' || schema['type'] === 'number') return '1';
  if (schema['type'] === 'boolean') return 'true';

  if (parameter.name.toLowerCase().includes('iso')) {
    return '2026-02-20T10:00:00.000Z';
  }
  if (parameter.name.toLowerCase().includes('from')) {
    return '2026-02-20T10:00:00.000Z';
  }
  if (parameter.name.toLowerCase().includes('to')) {
    return '2026-02-20T10:10:00.000Z';
  }
  if (parameter.name.toLowerCase().includes('limit')) {
    return '1';
  }

  return `${parameter.name}-1`;
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
