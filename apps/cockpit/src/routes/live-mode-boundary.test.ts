import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) files.push(fullPath);
  }
  return files;
}

function isProductionSource(filePath: string): boolean {
  const rel = relative(srcRoot, filePath).split(sep).join('/');
  return (
    !rel.startsWith('mocks/') &&
    !rel.endsWith('.test.ts') &&
    !rel.endsWith('.test.tsx') &&
    !rel.endsWith('.stories.tsx') &&
    !rel.endsWith('.d.ts')
  );
}

describe('live mode source boundary', () => {
  it('keeps mock fixture imports out of production cockpit source', () => {
    const offenders = collectSourceFiles(srcRoot)
      .filter(isProductionSource)
      .flatMap((filePath) => {
        const content = readFileSync(filePath, 'utf8');
        const rel = relative(srcRoot, filePath).split(sep).join('/');
        const hasFixtureImport =
          /from\s+['"][^'"]*mocks\/fixtures/.test(content) ||
          /import\s*\(\s*['"][^'"]*mocks\/fixtures/.test(content);
        return hasFixtureImport ? [rel] : [];
      });

    expect(offenders).toEqual([]);
  });
});
