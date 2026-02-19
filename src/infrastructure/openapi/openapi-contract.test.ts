import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import { appendEvidenceEntryV1 } from '../../domain/evidence/evidence-chain-v1.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import { parsePlanV1 } from '../../domain/plan/plan-v1.js';
import { parseWorkItemV1 } from '../../domain/work-items/work-item-v1.js';
import {
  CorrelationId,
  EvidenceId,
  HashSha256,
  PlanId,
  PORT_FAMILIES,
  RunId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';

function resolveRepoRoot(): string {
  const testFilePath = fileURLToPath(import.meta.url);
  const testDir = path.dirname(testFilePath);
  return path.resolve(testDir, '../../..');
}

async function readText(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf8');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stripOpenApiKeywords(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripOpenApiKeywords);
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    // OpenAPI-specific keyword; not valid JSON Schema.
    if (k === 'discriminator') continue;
    out[k] = stripOpenApiKeywords(v);
  }
  return out;
}

function rewriteComponentRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewriteComponentRefs);
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === '$ref' && typeof v === 'string') {
      out[k] = v.replace('#/components/schemas/', '#/$defs/');
      continue;
    }
    out[k] = rewriteComponentRefs(v);
  }
  return out;
}

function buildJsonSchemaFromComponents(params: {
  rootName: string;
  componentsSchemas: Record<string, unknown>;
}): object {
  const defs = rewriteComponentRefs(stripOpenApiKeywords(deepCloneJson(params.componentsSchemas)));
  if (!isRecord(defs)) throw new Error('components.schemas must be an object.');

  const root = defs[params.rootName];
  if (!isRecord(root)) throw new Error(`Missing components.schemas.${params.rootName}`);

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://portarium.local/schema/${params.rootName}.schema.json`,
    ...root,
    $defs: defs,
  };
}

function validateOrThrow(validateFn: (data: unknown) => boolean, data: unknown): void {
  const ok = validateFn(data);
  if (ok) return;
  const errors = (validateFn as unknown as { errors?: unknown }).errors;
  throw new Error(errors ? JSON.stringify(errors, null, 2) : 'Schema validation failed.');
}

const OPENAPI_SPEC_RELATIVE_PATH = 'docs/spec/openapi/portarium-control-plane.v1.yaml';

function mustRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function listOperationIds(pathsObj: Record<string, unknown>): string[] {
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);
  const out: string[] = [];

  for (const item of Object.values(pathsObj)) {
    if (!isRecord(item)) continue;
    for (const [k, op] of Object.entries(item)) {
      if (!methods.has(k)) continue;
      if (!isRecord(op)) continue;
      const operationId = op['operationId'];
      if (typeof operationId !== 'string' || operationId.trim() === '') continue;
      out.push(operationId);
    }
  }

  return out;
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();

  for (const v of values) {
    if (seen.has(v)) {
      dupes.add(v);
      continue;
    }
    seen.add(v);
  }

  return [...dupes].sort((a, b) => a.localeCompare(b));
}

describe('OpenAPI contract', () => {
  it('OpenAPI parses and operationIds are unique', async () => {
    const repoRoot = resolveRepoRoot();
    const specPath = path.join(repoRoot, OPENAPI_SPEC_RELATIVE_PATH);

    const doc = parseYaml(await readText(specPath)) as unknown;
    const docObj = mustRecord(doc, 'OpenAPI');

    expect(docObj['openapi']).toBe('3.1.0');

    const info = mustRecord(docObj['info'], 'OpenAPI.info');
    expect(typeof info['title']).toBe('string');
    expect(typeof info['version']).toBe('string');

    const pathsObj = mustRecord(docObj['paths'], 'OpenAPI.paths');

    const expectedPaths = [
      '/v1/workspaces',
      '/v1/workspaces/{workspaceId}',
      '/v1/workspaces/{workspaceId}/users',
      '/v1/workspaces/{workspaceId}/users/{userId}',
      '/v1/workspaces/{workspaceId}/work-items',
      '/v1/workspaces/{workspaceId}/work-items/{workItemId}',
      '/v1/workspaces/{workspaceId}/work-items/{workItemId}/assignment',
      '/v1/workspaces/{workspaceId}/workforce',
      '/v1/workspaces/{workspaceId}/workforce/{workforceMemberId}',
      '/v1/workspaces/{workspaceId}/workforce/{workforceMemberId}/availability',
      '/v1/workspaces/{workspaceId}/workforce/queues',
      '/v1/workspaces/{workspaceId}/human-tasks',
      '/v1/workspaces/{workspaceId}/human-tasks/{humanTaskId}',
      '/v1/workspaces/{workspaceId}/human-tasks/{humanTaskId}/assign',
      '/v1/workspaces/{workspaceId}/human-tasks/{humanTaskId}/complete',
      '/v1/workspaces/{workspaceId}/human-tasks/{humanTaskId}/escalate',
      '/v1/workspaces/{workspaceId}/plans/{planId}',
      '/v1/workspaces/{workspaceId}/evidence',
    ];
    for (const p of expectedPaths) {
      expect(Object.prototype.hasOwnProperty.call(pathsObj, p)).toBe(true);
    }

    const operationIds = listOperationIds(pathsObj);
    expect(operationIds.length).toBeGreaterThan(0);
    expect(findDuplicates(operationIds)).toEqual([]);
  });

  it('PortFamily enum matches domain primitives', async () => {
    const repoRoot = resolveRepoRoot();
    const specPath = path.join(repoRoot, OPENAPI_SPEC_RELATIVE_PATH);

    const doc = parseYaml(await readText(specPath)) as unknown;
    if (!isRecord(doc)) throw new Error('OpenAPI must be an object.');

    const components = doc['components'];
    if (!isRecord(components)) throw new Error('OpenAPI.components must be an object.');

    const schemas = components['schemas'];
    if (!isRecord(schemas)) throw new Error('OpenAPI.components.schemas must be an object.');

    const portFamily = schemas['PortFamily'];
    if (!isRecord(portFamily)) throw new Error('Missing components.schemas.PortFamily');

    const enumRaw = portFamily['enum'];
    if (!Array.isArray(enumRaw) || enumRaw.some((x) => typeof x !== 'string')) {
      throw new Error('PortFamily.enum must be an array of strings');
    }

    expect(enumRaw).toEqual([...PORT_FAMILIES]);
  });

  it('PlanV1, EvidenceEntryV1, and WorkItemV1 schemas validate representative payloads', async () => {
    const repoRoot = resolveRepoRoot();
    const specPath = path.join(repoRoot, OPENAPI_SPEC_RELATIVE_PATH);

    const doc = parseYaml(await readText(specPath)) as unknown;
    if (!isRecord(doc)) throw new Error('OpenAPI must be an object.');

    const components = doc['components'];
    if (!isRecord(components)) throw new Error('OpenAPI.components must be an object.');

    const schemas = components['schemas'];
    if (!isRecord(schemas)) throw new Error('OpenAPI.components.schemas must be an object.');

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats.default(ajv);

    const planSchema = buildJsonSchemaFromComponents({
      rootName: 'PlanV1',
      componentsSchemas: schemas,
    });
    const validatePlan = ajv.compile(planSchema);

    const plan = {
      schemaVersion: 1,
      planId: 'plan-1',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      plannedEffects: [
        {
          effectId: 'eff-1',
          operation: 'Create',
          target: {
            sorName: 'stripe',
            portFamily: 'PaymentsBilling',
            externalId: 'cus_123',
            externalType: 'Customer',
            displayLabel: 'cus_123',
            deepLinkUrl: 'https://dashboard.stripe.com/customers/cus_123',
          },
          summary: 'Create Customer in Stripe',
          idempotencyKey: 'idempotency-1',
        },
      ],
    };

    expect(() => parsePlanV1(plan)).not.toThrow();
    expect(() => validateOrThrow(validatePlan, plan)).not.toThrow();

    const invalidPlan = { ...plan, schemaVersion: 2 };
    expect(() => parsePlanV1(invalidPlan)).toThrow(/schemaVersion/i);
    expect(validatePlan(invalidPlan)).toBe(false);

    const evidenceSchema = buildJsonSchemaFromComponents({
      rootName: 'EvidenceEntryV1',
      componentsSchemas: schemas,
    });
    const validateEvidence = ajv.compile(evidenceSchema);

    const hasher = new NodeCryptoEvidenceHasher();
    const baseEvidence: Omit<EvidenceEntryV1, 'previousHash' | 'hashSha256'> = {
      schemaVersion: 1,
      evidenceId: EvidenceId('evi-1'),
      workspaceId: WorkspaceId('ws-1'),
      correlationId: CorrelationId('corr-1'),
      occurredAtIso: '2026-02-16T00:00:00.000Z',
      category: 'Plan',
      summary: 'Plan generated',
      actor: { kind: 'System' },
      links: { planId: PlanId('plan-1'), runId: RunId('run-1') },
      payloadRefs: [{ kind: 'Snapshot', uri: 'evidence://snapshots/plan-1.json' }],
    };

    const evidence = appendEvidenceEntryV1({ previous: undefined, next: baseEvidence, hasher });
    expect(() => validateOrThrow(validateEvidence, evidence)).not.toThrow();

    const invalidEvidence = { ...evidence, hashSha256: HashSha256('not-a-sha') };
    expect(validateEvidence(invalidEvidence)).toBe(false);

    const workItemSchema = buildJsonSchemaFromComponents({
      rootName: 'WorkItemV1',
      componentsSchemas: schemas,
    });
    const validateWorkItem = ajv.compile(workItemSchema);

    const workItem = {
      schemaVersion: 1,
      workItemId: 'wi-1',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      title: 'Investigate PROJ-123',
      status: 'Open',
      ownerUserId: 'user-2',
      sla: { dueAtIso: '2026-02-20T00:00:00.000Z' },
      links: {
        externalRefs: [
          {
            sorName: 'jira',
            portFamily: 'ProjectsWorkMgmt',
            externalId: 'PROJ-123',
            externalType: 'Issue',
            displayLabel: 'PROJ-123',
            deepLinkUrl: 'https://jira.example.com/browse/PROJ-123',
          },
        ],
        runIds: ['run-1'],
        approvalIds: ['approval-1'],
        evidenceIds: ['evi-1'],
      },
    };

    expect(() => parseWorkItemV1(workItem)).not.toThrow();
    expect(() => validateOrThrow(validateWorkItem, workItem)).not.toThrow();

    const invalidWorkItem = { ...workItem, status: 'Unknown' };
    expect(() => parseWorkItemV1(invalidWorkItem)).toThrow(/status/i);
    expect(validateWorkItem(invalidWorkItem)).toBe(false);
  });
});
