import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const errors = [];

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function pushIfMissing(relPath) {
  if (!exists(relPath)) errors.push(`Missing required path: ${relPath}`);
}

function collectRootScratch() {
  const scratchPattern = /^tmp[_-].+\.(log|txt|out|json|ts)$/i;
  return fs
    .readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && scratchPattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function collectFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const out = [];
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        out.push(path.relative(repoRoot, abs));
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

pushIfMissing('docs/reference/repo-organization.md');
pushIfMissing('docs/internal/index.md');
pushIfMissing('docs/internal/runbooks/repo-hygiene.md');
pushIfMissing('qa-artifacts/README.md');

const qaEvidenceFiles = collectFiles(path.join(repoRoot, 'docs', 'internal', 'qa', 'evidence'));
if (qaEvidenceFiles.length > 0) {
  errors.push(
    `Manual QA evidence is in docs/internal/qa/evidence (${qaEvidenceFiles.length} files). Move it to qa-artifacts/manual-evidence/.`,
  );
}

const dotTmpFiles = collectFiles(path.join(repoRoot, '.tmp'));
if (dotTmpFiles.length > 0) {
  errors.push(`.tmp contains ${dotTmpFiles.length} files. Move scratch files to tmp/local-scratch/.`);
}

const rootScratch = collectRootScratch();
if (rootScratch.length > 0) {
  errors.push(
    `Root scratch files detected (${rootScratch.length}): ${rootScratch.join(', ')}. Run npm run repo:cleanup:local.`,
  );
}

if (errors.length > 0) {
  console.error('Repository organization check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Repository organization check passed.');

