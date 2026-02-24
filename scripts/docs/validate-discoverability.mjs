import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const errors = [];

function read(filePath) {
  return readFileSync(resolve(filePath), 'utf8');
}

function assertIncludes(filePath, snippets) {
  const content = read(filePath);
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      errors.push(`${filePath} missing required snippet: ${snippet}`);
    }
  }
}

function assertExcludes(filePath, patterns) {
  const content = read(filePath);
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      errors.push(`${filePath} contains forbidden pattern: ${pattern}`);
    }
  }
}

assertIncludes('README.md', [
  'Evaluate in 15-30 min: `docs/getting-started/hello-portarium.md`',
  'If you only read one page next: `docs/index.md`',
]);

assertIncludes('docs/index.md', [
  '## First 30 Minutes',
  '`docs/getting-started/hello-portarium.md`',
  '`docs/tutorials/hello-governed-workflow.md`',
]);

assertIncludes('docs/getting-started/hello-portarium.md', [
  'npm ci',
  'npm run dev:all',
  'npm run dev:seed',
  'http://localhost:8080/healthz',
  'npm run smoke:governed-run',
]);

assertExcludes('docs/getting-started/hello-portarium.md', [
  /\bnpm install\b/,
  /^\s*npm run dev\s*$/m,
  /\bnpm run db:seed\b/,
  /localhost:3000/,
]);

const beadWorkflowDocs = [
  'CONTRIBUTING.md',
  'docs/getting-started/contributor-onboarding.md',
  'docs/getting-started/dev-workflow.md',
];

for (const filePath of beadWorkflowDocs) {
  assertIncludes(filePath, ['issue start', 'issue finish']);
  assertExcludes(filePath, [/\bissue close\b/, /\bissue claim\b/]);
}

if (errors.length > 0) {
  console.error('docs discoverability validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('docs discoverability validation passed');
