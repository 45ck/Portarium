import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const assetRoot = path.join(repoRoot, 'apps', 'cockpit', 'public', 'assets');

const npxExecutable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npxExecutable, ['svgo', '-rf', assetRoot, '-o', assetRoot], {
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('[cockpit:assets:optimize] SVG optimization complete');
