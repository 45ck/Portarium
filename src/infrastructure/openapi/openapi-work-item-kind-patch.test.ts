import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import { mustRecord, readText, resolveRepoRoot } from './openapi-contract.test-helpers.js';

const OPENAPI_BASE_SPEC = 'docs/spec/openapi/portarium-control-plane.v1.yaml';
const OPENAPI_PATCH_SPEC = 'docs/spec/openapi/patches/work-item-kind-v1-compat.yaml';

describe('OpenAPI WorkItem.kind patch contract', () => {
  it('patch file defines kind schemas and request rules', async () => {
    const repoRoot = resolveRepoRoot();
    const patchPath = path.join(repoRoot, OPENAPI_PATCH_SPEC);

    const patchDoc = mustRecord(parseYaml(await readText(patchPath)) as unknown, 'PatchSpec');
    const components = mustRecord(patchDoc['components'], 'PatchSpec.components');
    const parameters = mustRecord(components['parameters'], 'PatchSpec.components.parameters');
    const schemas = mustRecord(components['schemas'], 'PatchSpec.components.schemas');
    const paths = mustRecord(patchDoc['paths'], 'PatchSpec.paths');

    const workItemKindQuery = mustRecord(parameters['WorkItemKindQuery'], 'WorkItemKindQuery');
    expect(workItemKindQuery['name']).toBe('kind');
    expect(workItemKindQuery['in']).toBe('query');

    const workItemKind = mustRecord(schemas['WorkItemKind'], 'WorkItemKind');
    expect(workItemKind['type']).toBe('string');
    expect(workItemKind['enum']).toEqual(['case', 'change', 'investigation']);

    const workItemV2 = mustRecord(schemas['WorkItemV2'], 'WorkItemV2');
    const workItemV2Props = mustRecord(workItemV2['properties'], 'WorkItemV2.properties');
    expect(Object.prototype.hasOwnProperty.call(workItemV2Props, 'kind')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(workItemV2Props, 'subtype')).toBe(true);

    const createWorkItemRequestV2 = mustRecord(schemas['CreateWorkItemRequestV2'], 'CreateWorkItemRequestV2');
    expect(createWorkItemRequestV2['required']).toEqual(['title', 'kind']);

    const updateWorkItemRequestV2 = mustRecord(schemas['UpdateWorkItemRequestV2'], 'UpdateWorkItemRequestV2');
    const updateProps = mustRecord(updateWorkItemRequestV2['properties'], 'UpdateWorkItemRequestV2.properties');
    expect(Object.prototype.hasOwnProperty.call(updateProps, 'kind')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(updateProps, 'subtype')).toBe(true);

    const workItemsPath = mustRecord(paths['/v1/workspaces/{workspaceId}/work-items'], 'work-items path');
    const getWorkItems = mustRecord(workItemsPath['get'], 'get work-items');
    const params = getWorkItems['parameters'];
    expect(Array.isArray(params)).toBe(true);
  });

  it('base spec still contains the work item routes that receive the patch', async () => {
    const repoRoot = resolveRepoRoot();
    const specPath = path.join(repoRoot, OPENAPI_BASE_SPEC);

    const baseDoc = mustRecord(parseYaml(await readText(specPath)) as unknown, 'BaseSpec');
    const paths = mustRecord(baseDoc['paths'], 'BaseSpec.paths');

    expect(Object.prototype.hasOwnProperty.call(paths, '/v1/workspaces/{workspaceId}/work-items')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(paths, '/v1/workspaces/{workspaceId}/work-items/{workItemId}')).toBe(true);
  });
});
