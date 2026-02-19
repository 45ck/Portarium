import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parsePackConnectorMappingV1 } from './pack-connector-mapping-v1.js';
import { parsePackManifestV1 } from './pack-manifest.js';
import { parsePackSchemaExtensionV1 } from './pack-schema-extension-v1.js';
import { parsePackTestAssetV1 } from './pack-test-asset-v1.js';
import { parsePackUiTemplateV1 } from './pack-ui-template-v1.js';
import { parsePackWorkflowDefinitionV1 } from './pack-workflow-definition-v1.js';

function resolveRepoRoot(): string {
  const testFilePath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(testFilePath), '../../..');
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

describe('software change management reference pack artefacts', () => {
  it('parses manifest and all declared assets', async () => {
    const repoRoot = resolveRepoRoot();
    const packRoot = path.join(repoRoot, 'vertical-packs', 'software-change-management');

    const manifest = parsePackManifestV1(await readJson(path.join(packRoot, 'pack.manifest.json')));
    expect(manifest.id).toBe('scm.change-management');
    expect(manifest.assets.schemas).toContain('schemas/change-control-extension.json');
    expect(manifest.assets.workflows).toContain('workflows/change-request-lifecycle.json');
    expect(manifest.assets.uiTemplates).toContain('ui-templates/change-request-form.json');
    expect(manifest.assets.mappings).toContain('mappings/change-ticket-mapping.json');
    expect(manifest.assets.testAssets).toContain('tests/change-evidence-fixture.json');

    const schema = await readJson(path.join(packRoot, 'schemas/change-control-extension.json'));
    const workflow = await readJson(path.join(packRoot, 'workflows/change-request-lifecycle.json'));
    const uiTemplate = await readJson(path.join(packRoot, 'ui-templates/change-request-form.json'));
    const mapping = await readJson(path.join(packRoot, 'mappings/change-ticket-mapping.json'));
    const testAsset = await readJson(path.join(packRoot, 'tests/change-evidence-fixture.json'));

    expect(() => parsePackSchemaExtensionV1(schema)).not.toThrow();
    expect(() => parsePackWorkflowDefinitionV1(workflow)).not.toThrow();
    expect(() => parsePackUiTemplateV1(uiTemplate)).not.toThrow();
    expect(() => parsePackConnectorMappingV1(mapping)).not.toThrow();
    expect(() => parsePackTestAssetV1(testAsset)).not.toThrow();
  });
});
