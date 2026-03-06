import { readdirSync, readFileSync } from 'node:fs';

export const DEFAULT_CANONICAL_DIR = 'src/domain/canonical';
export const DEFAULT_INDEX_PATH = 'src/domain/canonical/index.ts';
export const DEFAULT_SPEC_PATH = '.specify/specs/canonical-objects-v1.md';
export const DEFAULT_DOCS_PATH = 'docs/domain/canonical-objects.md';

export function readCanonicalParserModules(canonicalDir = DEFAULT_CANONICAL_DIR) {
  return readdirSync(canonicalDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) => filename.endsWith('-v1.ts'))
    .filter((filename) => !filename.endsWith('.test.ts'))
    .filter((filename) => filename !== 'objects-v1.ts')
    .sort();
}

export function stripParserVersionSuffix(filename) {
  return filename.replace(/-v1\.ts$/, '');
}

export function readCanonicalBarrelModules(indexPath = DEFAULT_INDEX_PATH) {
  const raw = readFileSync(indexPath, 'utf8');
  return [...raw.matchAll(/^export\s+\*\s+from\s+'\.\/(.+?)\.js';$/gm)]
    .map((match) => match[1])
    .sort();
}

export function readSpecParserModules(specPath = DEFAULT_SPEC_PATH) {
  const raw = readFileSync(specPath, 'utf8');
  return new Set(
    raw
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*-\s*`src\/domain\/canonical\/([\w-]+-v1\.ts)`/))
      .map((match) => match?.[1] ?? null)
      .filter(Boolean),
  );
}

export function readDocsCanonicalRows(docsPath = DEFAULT_DOCS_PATH) {
  const raw = readFileSync(docsPath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.match(/^\|\s*\*\*([^*]+)\*\*\s*\|\s*`([^`]+)`/))
    .filter(Boolean)
    .map((match) => ({
      displayName: match[1],
      runtimeContract: match[2],
    }))
    .filter((row) => row.runtimeContract.length > 0);
}

export function readDocsDeclaredCount(docsPath = DEFAULT_DOCS_PATH) {
  const raw = readFileSync(docsPath, 'utf8');
  const match = raw.match(/^> The (\d+)-member canonical object set/m);
  if (!match) {
    throw new Error(`No canonical set count found in ${docsPath}.`);
  }
  return Number.parseInt(match[1], 10);
}
