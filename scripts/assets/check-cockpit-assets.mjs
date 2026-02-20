import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import manifest from '../../apps/cockpit/src/assets/manifest.json' with { type: 'json' };

const repoRoot = process.cwd();
const assetRoot = path.join(repoRoot, 'apps', 'cockpit', 'public', 'assets');

function runNodeScript(relativePath) {
  const result = spawnSync('node', [path.join(repoRoot, relativePath)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

function fail(message) {
  console.error(`[cockpit:assets:check] ${message}`);
  process.exitCode = 1;
}

async function verifyOrphans() {
  const allFiles = (await walk(assetRoot)).filter((file) => path.basename(file) !== '.gitkeep');
  const manifestFiles = new Set(
    manifest.assets.flatMap((asset) =>
      Object.values(asset.paths).map((assetPath) =>
        path.join(repoRoot, 'apps', 'cockpit', 'public', assetPath.replace(/^\/+/, '')),
      ),
    ),
  );

  for (const file of allFiles) {
    if (!manifestFiles.has(file)) {
      fail(`orphaned file not listed in manifest: ${path.relative(repoRoot, file)}`);
    }
  }

  for (const file of manifestFiles) {
    if (!allFiles.includes(file)) {
      fail(`manifest path not found on disk: ${path.relative(repoRoot, file)}`);
    }
  }
}

runNodeScript('scripts/assets/validate-cockpit-assets.mjs');
await verifyOrphans();

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('[cockpit:assets:check] OK (no orphans, manifest is consistent)');
