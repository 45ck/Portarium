import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function resolveRepoRoot(): string {
  const testFilePath = fileURLToPath(import.meta.url);
  const testDir = path.dirname(testFilePath);
  return path.resolve(testDir, '../../..');
}

interface OperationStub {
  readonly schemaVersion: string;
  readonly portFamily: string;
  readonly sourceCatalog: string;
  readonly operations: readonly {
    readonly operation: string;
    readonly description: string;
    readonly idempotent: boolean;
  }[];
}

describe('Domain Atlas operation contract stubs', () => {
  it('contains machine-readable operation stubs for all 18 standard families', async () => {
    const repoRoot = resolveRepoRoot();
    const stubsRoot = path.join(repoRoot, 'domain-atlas', 'fixtures', 'operation-contract-stubs');
    const indexPath = path.join(stubsRoot, 'index.json');

    const indexText = await readFile(indexPath, 'utf8');
    const index = JSON.parse(indexText) as {
      readonly schemaVersion: string;
      readonly families: readonly { readonly portFamily: string; readonly file: string }[];
    };

    expect(index.schemaVersion).toBe('1.0.0');
    expect(index.families).toHaveLength(18);

    const files = await readdir(stubsRoot, { withFileTypes: true });
    const familyFiles = files
      .filter((entry) => entry.isFile() && entry.name.endsWith('.operations.stub.json'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    expect(familyFiles).toHaveLength(18);

    for (const family of index.families) {
      const filePath = path.join(repoRoot, family.file);
      const text = await readFile(filePath, 'utf8');
      const stub = JSON.parse(text) as OperationStub;

      expect(stub.schemaVersion).toBe('1.0.0');
      expect(stub.portFamily).toBe(family.portFamily);
      expect(stub.operations.length).toBeGreaterThan(0);
      expect(stub.operations.every((op) => op.operation.length > 0)).toBe(true);
      expect(stub.operations.every((op) => op.description.length > 0)).toBe(true);
    }
  });
});
