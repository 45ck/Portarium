import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import {
  findDuplicates,
  listOperationIds,
  mustRecord,
  readText,
  resolveRepoRoot,
} from './openapi-contract.test-helpers.js';

const OPENAPI_SPEC_RELATIVE_PATH = 'docs/spec/openapi/portarium-control-plane.v1.yaml';
const GOLDEN_RELATIVE_PATH = 'src/infrastructure/openapi/openapi-operation-ids.golden.json';

describe('OpenAPI operationId golden fixture', () => {
  it('matches parsed OpenAPI operationIds exactly', async () => {
    const repoRoot = resolveRepoRoot();
    const specPath = path.join(repoRoot, OPENAPI_SPEC_RELATIVE_PATH);
    const goldenPath = path.join(repoRoot, GOLDEN_RELATIVE_PATH);

    const specDoc = mustRecord(parseYaml(await readText(specPath)) as unknown, 'OpenAPI');
    const pathsObj = mustRecord(specDoc['paths'], 'OpenAPI.paths');

    const parsedOperationIds = listOperationIds(pathsObj);
    expect(findDuplicates(parsedOperationIds)).toEqual([]);
    const expectedOperationIds = [...new Set(parsedOperationIds)].sort((a, b) => a.localeCompare(b));

    const golden = mustRecord(JSON.parse(await readText(goldenPath)) as unknown, 'OpenAPI golden');
    expect(golden['openapiSpecPath']).toBe(OPENAPI_SPEC_RELATIVE_PATH);

    const goldenOperationIds = golden['operationIds'];
    expect(Array.isArray(goldenOperationIds)).toBe(true);
    expect(goldenOperationIds).toEqual(expectedOperationIds);
  });

  it('contains consistent metadata fields', async () => {
    const repoRoot = resolveRepoRoot();
    const goldenPath = path.join(repoRoot, GOLDEN_RELATIVE_PATH);

    const golden = mustRecord(JSON.parse(await readText(goldenPath)) as unknown, 'OpenAPI golden');
    const operationIds = golden['operationIds'];
    if (!Array.isArray(operationIds) || operationIds.some((value) => typeof value !== 'string')) {
      throw new Error('OpenAPI golden operationIds must be string[].');
    }
    const operationIdsList = operationIds as string[];

    const operationCount = golden['operationCount'];
    expect(operationCount).toBe(operationIdsList.length);
    expect(findDuplicates(operationIdsList)).toEqual([]);
    expect(operationIdsList).toEqual(
      [...operationIdsList].sort((a, b) => a.localeCompare(b)),
    );
  });
});
