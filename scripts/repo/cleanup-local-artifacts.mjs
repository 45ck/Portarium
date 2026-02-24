import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const dryRun = process.argv.includes('--dry-run');

const actions = [];

function ensureDir(dirPath) {
  if (fs.existsSync(dirPath)) return;
  actions.push(`mkdir ${path.relative(repoRoot, dirPath)}`);
  if (!dryRun) fs.mkdirSync(dirPath, { recursive: true });
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
        out.push(abs);
      }
    }
  }
  return out;
}

function uniqueTarget(destDir, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(destDir, fileName);
  let index = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(destDir, `${parsed.name}.${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function moveFile(srcPath, destDir, prefix = '') {
  ensureDir(destDir);
  const baseName = path.basename(srcPath);
  const targetName = prefix ? `${prefix}-${baseName}` : baseName;
  const destPath = uniqueTarget(destDir, targetName);
  actions.push(`move ${path.relative(repoRoot, srcPath)} -> ${path.relative(repoRoot, destPath)}`);
  if (!dryRun) fs.renameSync(srcPath, destPath);
}

function removeEmptyDirs(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    removeEmptyDirs(path.join(dirPath, entry.name));
  }
  if (fs.readdirSync(dirPath).length === 0) {
    actions.push(`rmdir ${path.relative(repoRoot, dirPath)}`);
    if (!dryRun) fs.rmdirSync(dirPath);
  }
}

function moveQaEvidence() {
  const sourceDir = path.join(repoRoot, 'docs', 'internal', 'qa', 'evidence');
  const targetDir = path.join(repoRoot, 'qa-artifacts', 'manual-evidence');
  const files = collectFiles(sourceDir);
  for (const filePath of files) {
    moveFile(filePath, targetDir, 'qa');
  }
  removeEmptyDirs(sourceDir);
}

function moveRootScratchFiles() {
  const rootEntries = fs.readdirSync(repoRoot, { withFileTypes: true });
  const targetDir = path.join(repoRoot, 'tmp', 'local-scratch');
  const scratchPattern = /^tmp[_-].+\.(log|txt|out|json|ts)$/i;

  for (const entry of rootEntries) {
    if (!entry.isFile()) continue;
    if (!scratchPattern.test(entry.name)) continue;
    const absPath = path.join(repoRoot, entry.name);
    moveFile(absPath, targetDir, 'root');
  }
}

function moveDotTmpFiles() {
  const dotTmpDir = path.join(repoRoot, '.tmp');
  const targetDir = path.join(repoRoot, 'tmp', 'local-scratch', 'dot-tmp');
  const files = collectFiles(dotTmpDir);
  for (const filePath of files) {
    moveFile(filePath, targetDir, 'dot-tmp');
  }
  removeEmptyDirs(dotTmpDir);
}

moveQaEvidence();
moveRootScratchFiles();
moveDotTmpFiles();

if (actions.length === 0) {
  console.log('No cleanup actions needed.');
  process.exit(0);
}

for (const action of actions) {
  console.log(action);
}
console.log(`\n${dryRun ? 'Dry run complete.' : 'Cleanup complete.'} Actions: ${actions.length}`);

