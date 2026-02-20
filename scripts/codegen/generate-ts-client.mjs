#!/usr/bin/env node
// generate-ts-client.mjs -- Generate TypeScript types from the Portarium OpenAPI spec
//
// Beads: bead-0660
//
// Prerequisites:
//   npm install -D openapi-typescript
//
// Usage:
//   node scripts/codegen/generate-ts-client.mjs          # regenerate in-place
//   node scripts/codegen/generate-ts-client.mjs --check   # CI diff check (exit 1 if changed)

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const OPENAPI_SPEC = resolve(REPO_ROOT, 'docs/spec/openapi/portarium-control-plane.v1.yaml');
const OUTPUT_DIR = resolve(REPO_ROOT, 'src/sdk/generated');
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'control-plane.ts');
const INFRA_OUTPUT_FILE = resolve(REPO_ROOT, 'src/infrastructure/openapi/generated-client-types.ts');

const isCheck = process.argv.includes('--check');

// --- Preflight ---

if (!existsSync(OPENAPI_SPEC)) {
  console.error(`ERROR: OpenAPI spec not found at ${OPENAPI_SPEC}`);
  process.exit(1);
}

// --- Generate ---

console.log(`Generating TypeScript types from ${OPENAPI_SPEC} ...`);

mkdirSync(OUTPUT_DIR, { recursive: true });

try {
  execSync(
    `npx openapi-typescript "${OPENAPI_SPEC}" --output "${OUTPUT_FILE}"`,
    { cwd: REPO_ROOT, stdio: 'inherit' },
  );
} catch {
  console.error('ERROR: openapi-typescript generation failed.');
  process.exit(1);
}

// Add header comment
const generated = readFileSync(OUTPUT_FILE, 'utf-8');
const header = [
  '// Auto-generated from docs/spec/openapi/portarium-control-plane.v1.yaml',
  '// Do not edit manually. Run `npm run codegen:sdk` to regenerate.',
  '// Bead: bead-0660',
  '',
].join('\n');

if (!generated.startsWith('// Auto-generated')) {
  writeFileSync(OUTPUT_FILE, header + generated, 'utf-8');
}

// Also write to infrastructure/openapi for co-location with OpenAPI contracts
const infraDir = dirname(INFRA_OUTPUT_FILE);
mkdirSync(infraDir, { recursive: true });
writeFileSync(INFRA_OUTPUT_FILE, header + generated, 'utf-8');

console.log(`TypeScript types generated at ${OUTPUT_FILE}`);
console.log(`TypeScript types mirrored at ${INFRA_OUTPUT_FILE}`);

// --- CI diff check ---

if (isCheck) {
  console.log('Running CI diff check ...');
  try {
    execSync(`git diff --exit-code -- "${OUTPUT_DIR}"`, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    console.log('OK: Generated TypeScript client matches committed version.');
  } catch {
    console.error('ERROR: Generated TypeScript client differs from committed version.');
    console.error('Run `npm run codegen:sdk` and commit the result.');
    process.exit(1);
  }
}
