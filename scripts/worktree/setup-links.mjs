#!/usr/bin/env node

/**
 * Junction-link shared directories from the repo root into a worktree.
 *
 * Usage:
 *   node scripts/worktree/setup-links.mjs          # run from inside .trees/<id>/
 *   node scripts/worktree/setup-links.mjs /path/to  # explicit worktree path
 *
 * Links node_modules, config dirs, and other shared directories so that
 * CI gates (typecheck, lint, spell, tests) work without `npm install`.
 */

import { existsSync, symlinkSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIRS_TO_LINK = [
  'node_modules',
  '.beads',
  '.ci',
  '.cspell',
  '.github',
  '.husky',
  '.specify',
  'apps',
  'k8s',
];

const worktreeRoot = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
const repoRoot = resolve(worktreeRoot, '../..');

if (!existsSync(join(repoRoot, 'package.json'))) {
  console.error(
    `Could not find repo root at ${repoRoot}. ` +
      'Run this script from inside .trees/<id>/ or pass the worktree path as an argument.',
  );
  process.exit(1);
}

let linked = 0;
let skipped = 0;

for (const dir of DIRS_TO_LINK) {
  const source = join(repoRoot, dir);
  const target = join(worktreeRoot, dir);

  if (!existsSync(source)) {
    continue;
  }

  if (existsSync(target)) {
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) {
      skipped++;
      continue;
    }
    // Real directory already exists (e.g. worktree checkout has it)
    skipped++;
    continue;
  }

  symlinkSync(source, target, 'junction');
  console.log(`  linked ${dir}`);
  linked++;
}

console.log(`Done. ${linked} linked, ${skipped} skipped.`);
