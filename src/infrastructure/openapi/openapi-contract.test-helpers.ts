import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveRepoRoot(): string {
  const thisFilePath = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFilePath);
  return path.resolve(thisDir, '../../..');
}

export async function readText(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf8');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
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

export function buildJsonSchemaFromComponents(params: {
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

export function validateOrThrow(validateFn: (data: unknown) => boolean, data: unknown): void {
  const ok = validateFn(data);
  if (ok) return;
  const errors = (validateFn as unknown as { errors?: unknown }).errors;
  throw new Error(errors ? JSON.stringify(errors, null, 2) : 'Schema validation failed.');
}

export function mustRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

export function listOperationIds(pathsObj: Record<string, unknown>): string[] {
  const out: string[] = [];

  for (const item of Object.values(pathsObj)) {
    if (!isRecord(item)) continue;
    for (const [method, op] of Object.entries(item)) {
      const operationId = maybeGetOperationId(method, op);
      if (operationId) out.push(operationId);
    }
  }

  return out;
}

function maybeGetOperationId(method: string, op: unknown): string | undefined {
  if (!HTTP_METHODS.has(method)) return undefined;
  if (!isRecord(op)) return undefined;

  const operationId = op['operationId'];
  if (typeof operationId !== 'string' || operationId.trim() === '') return undefined;

  return operationId;
}

export function findDuplicates(values: readonly string[]): string[] {
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
