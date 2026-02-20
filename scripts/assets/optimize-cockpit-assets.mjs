import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const assetRoot = path.join(repoRoot, 'apps', 'cockpit', 'public', 'assets');

const result = spawnSync('npx', ['svgo', '-rf', assetRoot, '-o', assetRoot], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('[cockpit:assets:optimize] SVG optimization complete');
