import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const movedDirs = [
  '_meta',
  'adr',
  'domain-atlas',
  'governance',
  'qa',
  'research',
  'review',
  'runbooks',
  'sprints',
  'ui',
  'vertical-packs',
];

const movedFiles = [
  'ADRs-v0.md',
  'ADR-amendments-and-new-ADRs.md',
  'application-layer-work-backlog.md',
  'developer-portal-plan.md',
  'domain-layer-work-backlog.md',
  'governance-work-backlog.md',
  'infrastructure-layer-work-backlog.md',
  'integration-layer-work-backlog.md',
  'open-decisions-backlog.md',
];

const errors = [];

for (const dirName of movedDirs) {
  const legacyPath = resolve('docs', dirName);
  const internalPath = resolve('docs', 'internal', dirName);
  if (existsSync(legacyPath)) {
    errors.push(`legacy directory must not exist: docs/${dirName}`);
  }
  if (!existsSync(internalPath)) {
    errors.push(`required internal directory missing: docs/internal/${dirName}`);
  }
}

for (const fileName of movedFiles) {
  const legacyPath = resolve('docs', fileName);
  const internalPath = resolve('docs', 'internal', fileName);
  if (existsSync(legacyPath)) {
    errors.push(`legacy file must not exist: docs/${fileName}`);
  }
  if (!existsSync(internalPath)) {
    errors.push(`required internal file missing: docs/internal/${fileName}`);
  }
}

if (!existsSync(resolve('docs', 'internal', 'index.md'))) {
  errors.push('required internal index missing: docs/internal/index.md');
}

if (errors.length > 0) {
  console.error('docs layout validation failed:');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log('docs layout validation passed');
