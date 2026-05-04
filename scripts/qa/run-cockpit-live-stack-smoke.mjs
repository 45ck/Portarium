#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');
const npmCommand = 'npm';
const nodeCommand = process.execPath;
const bundledNpmCliPath = join(dirname(nodeCommand), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npmCliPath =
  process.env['npm_execpath'] && process.env['npm_execpath'] !== 'undefined'
    ? process.env['npm_execpath']
    : existsSync(bundledNpmCliPath)
      ? bundledNpmCliPath
      : undefined;
const args = new Set(process.argv.slice(2));
const apiBaseUrl =
  process.env.PORTARIUM_LIVE_STACK_API_BASE_URL ??
  process.env.VITE_PORTARIUM_API_BASE_URL ??
  'http://localhost:8080';
const workspaceId = process.env.PORTARIUM_LIVE_STACK_WORKSPACE_ID ?? 'ws-local-dev';
const devToken = process.env.PORTARIUM_LIVE_STACK_DEV_TOKEN ?? process.env.PORTARIUM_DEV_TOKEN;
const required =
  args.has('--required') ||
  ['1', 'true', 'yes', 'on'].includes(
    (process.env.PORTARIUM_LIVE_STACK_SMOKE_REQUIRED ?? '').trim().toLowerCase(),
  );
const skipSeed =
  args.has('--skip-seed') ||
  ['1', 'true', 'yes', 'on'].includes(
    (process.env.PORTARIUM_LIVE_STACK_SMOKE_SKIP_SEED ?? '').trim().toLowerCase(),
  );

function run(command, commandArgs, env = process.env) {
  const [spawnCommand, spawnArgs] =
    process.platform === 'win32' && command === npmCommand
      ? [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', [command, ...commandArgs].join(' ')]]
      : [command, commandArgs];
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: repoRoot,
    env,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`[cockpit-live-stack] failed to start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNpm(commandArgs, env = process.env) {
  if (npmCliPath) {
    run(nodeCommand, [npmCliPath, ...commandArgs], env);
    return;
  }
  run(npmCommand, commandArgs, env);
}

async function isApiHealthy() {
  try {
    const response = await fetch(`${apiBaseUrl}/healthz`, {
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const healthy = await isApiHealthy();
if (!healthy) {
  const message = `[cockpit-live-stack] API unavailable at ${apiBaseUrl}; live-stack smoke skipped.`;
  if (!required) {
    console.log(message);
    console.log(
      '[cockpit-live-stack] Set PORTARIUM_LIVE_STACK_SMOKE_REQUIRED=true or pass --required to make absence fail.',
    );
    process.exit(0);
  }
  console.error(message);
  process.exit(1);
}

const smokeEnv = {
  ...process.env,
  PORTARIUM_LIVE_STACK_API_BASE_URL: apiBaseUrl,
  PORTARIUM_LIVE_STACK_WORKSPACE_ID: workspaceId,
  PORTARIUM_DEV_WORKSPACE_ID: workspaceId,
  VITE_PORTARIUM_API_BASE_URL: apiBaseUrl,
  VITE_PORTARIUM_DEFAULT_WORKSPACE_ID: workspaceId,
  VITE_PORTARIUM_ENABLE_MSW: 'false',
  ...(devToken ? { PORTARIUM_DEV_TOKEN: devToken } : {}),
};

if (!skipSeed) {
  console.log('[cockpit-live-stack] seeding live Cockpit workspace');
  runNpm(['run', 'seed:cockpit-live'], smokeEnv);
  runNpm(['run', 'seed:cockpit-live:validate'], smokeEnv);
}

console.log('[cockpit-live-stack] running Playwright live-stack smoke');
run(
  nodeCommand,
  [
    'node_modules/@playwright/test/cli.js',
    'test',
    '--config',
    'e2e/live-stack/playwright.config.ts',
    '--project',
    'live-chromium',
    '--workers',
    '1',
  ],
  smokeEnv,
);
