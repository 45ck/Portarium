#!/usr/bin/env node
// package-ts-sdk.mjs -- Create publishable TypeScript SDK package from generated OpenAPI types
//
// Beads: bead-0702

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const ROOT_PACKAGE_JSON = resolve(REPO_ROOT, 'package.json');
const GENERATED_TYPES = resolve(REPO_ROOT, 'src/sdk/generated/control-plane.ts');
const OUTPUT_DIR = resolve(REPO_ROOT, 'sdks/typescript/portarium-openapi-client');
const OUTPUT_TYPES = resolve(OUTPUT_DIR, 'index.d.ts');
const OUTPUT_README = resolve(OUTPUT_DIR, 'README.md');
const OUTPUT_PACKAGE = resolve(OUTPUT_DIR, 'package.json');

if (!existsSync(GENERATED_TYPES)) {
  console.error(`ERROR: Generated TypeScript types not found at ${GENERATED_TYPES}`);
  console.error('Run `npm run codegen:sdk` first.');
  process.exit(1);
}

const rootPackage = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, 'utf8'));
const version = typeof rootPackage.version === 'string' ? rootPackage.version : '0.1.0';

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

cpSync(GENERATED_TYPES, OUTPUT_TYPES);

const packageJson = {
  name: '@portarium/openapi-client',
  version,
  description: 'Type definitions generated from the Portarium OpenAPI contract',
  license: 'MIT',
  type: 'module',
  files: ['index.d.ts', 'README.md'],
  types: './index.d.ts',
  exports: {
    '.': {
      types: './index.d.ts',
    },
  },
  sideEffects: false,
};

const readme = [
  '# @portarium/openapi-client',
  '',
  'TypeScript definitions generated from `docs/spec/openapi/portarium-control-plane.v1.yaml`.',
  '',
  '## Regenerate',
  '',
  '```bash',
  'npm run codegen:sdk',
  'npm run codegen:sdk:package:ts',
  '```',
  '',
].join('\n');

writeFileSync(OUTPUT_PACKAGE, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_README, readme, 'utf8');

console.log(`Packaged TypeScript SDK at ${OUTPUT_DIR}`);
