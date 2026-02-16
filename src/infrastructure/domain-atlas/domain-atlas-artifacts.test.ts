import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

function resolveRepoRoot(): string {
  const testFilePath = fileURLToPath(import.meta.url);
  const testDir = path.dirname(testFilePath);
  return path.resolve(testDir, '../../..');
}

async function readJson(filePath: string): Promise<unknown> {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text) as unknown;
}

async function listDirs(dirPath: string): Promise<readonly string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

function validateOrThrow(validateFn: ValidateFunction, data: unknown): void {
  const valid = validateFn(data);
  if (valid) return;

  const message = validateFn.errors
    ? JSON.stringify(validateFn.errors, null, 2)
    : 'Schema validation failed with unknown error.';
  throw new Error(message);
}

describe('Domain Atlas artefacts', () => {
  it('schemas compile and example artefacts validate', async () => {
    const repoRoot = resolveRepoRoot();
    const atlasRoot = path.join(repoRoot, 'domain-atlas');
    const schemaRoot = path.join(atlasRoot, 'schema');

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats.default(ajv);

    const schemaPaths = {
      sourceManifest: path.join(schemaRoot, 'source-manifest.schema.json'),
      cif: path.join(schemaRoot, 'cif.schema.json'),
      mapping: path.join(schemaRoot, 'mapping.schema.json'),
      capabilityMatrix: path.join(schemaRoot, 'capability-matrix.schema.json'),
    };

    const schemas = {
      sourceManifest: await readJson(schemaPaths.sourceManifest),
      cif: await readJson(schemaPaths.cif),
      mapping: await readJson(schemaPaths.mapping),
      capabilityMatrix: await readJson(schemaPaths.capabilityMatrix),
    };

    const validators = {
      sourceManifest: ajv.compile(schemas.sourceManifest as object),
      cif: ajv.compile(schemas.cif as object),
      mapping: ajv.compile(schemas.mapping as object),
      capabilityMatrix: ajv.compile(schemas.capabilityMatrix as object),
    };

    const sourcesRoot = path.join(atlasRoot, 'sources');
    const extractedRoot = path.join(atlasRoot, 'extracted');
    const mappingsRoot = path.join(atlasRoot, 'mappings');
    const capabilitiesRoot = path.join(atlasRoot, 'capabilities');

    const sourceProviders = await listDirs(sourcesRoot);
    const extractedProviders = await listDirs(extractedRoot);
    const mappingProviders = await listDirs(mappingsRoot);
    const capabilityProviders = await listDirs(capabilitiesRoot);

    expect(sourceProviders).toContain('stripe');
    expect(extractedProviders).toContain('stripe');
    expect(mappingProviders).toContain('stripe');
    expect(capabilityProviders).toContain('stripe');

    for (const providerId of extractedProviders) {
      expect(sourceProviders).toContain(providerId);
    }

    for (const providerId of mappingProviders) {
      expect(sourceProviders).toContain(providerId);
    }

    for (const providerId of capabilityProviders) {
      expect(sourceProviders).toContain(providerId);
    }

    for (const providerId of sourceProviders) {
      const sourceManifest = await readJson(path.join(sourcesRoot, providerId, 'source.json'));
      expect(() => validateOrThrow(validators.sourceManifest, sourceManifest)).not.toThrow();
    }

    for (const providerId of extractedProviders) {
      const cif = await readJson(path.join(extractedRoot, providerId, 'cif.json'));
      expect(() => validateOrThrow(validators.cif, cif)).not.toThrow();
    }

    for (const providerId of mappingProviders) {
      const mapping = await readJson(path.join(mappingsRoot, providerId, 'mapping.json'));
      expect(() => validateOrThrow(validators.mapping, mapping)).not.toThrow();
    }

    for (const providerId of capabilityProviders) {
      const providerDir = path.join(capabilitiesRoot, providerId);
      const files = await readdir(providerDir, { withFileTypes: true });
      const matrices = files
        .filter((e) => e.isFile() && e.name.endsWith('.capability-matrix.json'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));

      for (const filename of matrices) {
        const matrix = await readJson(path.join(providerDir, filename));
        expect(() => validateOrThrow(validators.capabilityMatrix, matrix)).not.toThrow();
      }
    }
  });
});
