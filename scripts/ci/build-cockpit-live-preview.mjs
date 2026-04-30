import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const cockpitRoot = resolve('apps/cockpit');
const previewOutDir = 'dist-live-preview';
const previewApiBaseUrl =
  process.env.PORTARIUM_COCKPIT_PREVIEW_API_BASE_URL ?? 'http://127.0.0.1:4174';
const nodeExecutable = process.execPath;
const tscBin = resolve('node_modules/typescript/bin/tsc');
const viteBin = resolve('apps/cockpit/node_modules/vite/bin/vite.js');

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: cockpitRoot,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

rmSync(resolve(cockpitRoot, previewOutDir), { force: true, recursive: true });

run(nodeExecutable, [tscBin, '-b', 'tsconfig.app.json']);
run(nodeExecutable, [viteBin, 'build', '--outDir', previewOutDir], {
  VITE_PORTARIUM_ENABLE_MSW: 'false',
  VITE_PORTARIUM_API_BASE_URL: previewApiBaseUrl,
});
