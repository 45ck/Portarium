import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const worktree = process.argv[2];
if (!worktree) {
  console.error('Usage: node scripts/link-worktree.mjs <worktree-id>');
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const treePath = path.join(repoRoot, '.trees', worktree);

function link(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.symlinkSync(src, dest, 'junction');
    console.log(`Linked: ${dest}`);
  } else {
    console.log(`Already exists: ${dest}`);
  }
}

link(path.join(repoRoot, 'node_modules'), path.join(treePath, 'node_modules'));
link(
  path.join(repoRoot, 'apps', 'cockpit', 'node_modules'),
  path.join(treePath, 'apps', 'cockpit', 'node_modules'),
);
