#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeCommand = process.execPath;
const bundledNpmCliPath = join(dirname(nodeCommand), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npmCliPath =
  process.env['npm_execpath'] && process.env['npm_execpath'] !== 'undefined'
    ? process.env['npm_execpath']
    : existsSync(bundledNpmCliPath)
      ? bundledNpmCliPath
      : undefined;
const apiBaseUrl =
  process.env.PORTARIUM_LIVE_STACK_API_BASE_URL ??
  process.env.VITE_PORTARIUM_API_BASE_URL ??
  'http://localhost:8080';
const workspaceId = process.env.PORTARIUM_LIVE_STACK_WORKSPACE_ID ?? 'ws-local-dev';

const command = npmCliPath ? nodeCommand : npmCommand;
const commandArgs = npmCliPath
  ? [npmCliPath, 'run', '-w', 'apps/cockpit', 'dev:e2e']
  : ['run', '-w', 'apps/cockpit', 'dev:e2e'];

const child = spawn(command, commandArgs, {
  cwd: repoRoot,
  env: {
    ...process.env,
    VITE_PORTARIUM_API_BASE_URL: apiBaseUrl,
    VITE_PORTARIUM_CSP_CONNECT_MODE: 'local-only',
    VITE_PORTARIUM_DEFAULT_WORKSPACE_ID: workspaceId,
    VITE_PORTARIUM_ENABLE_MSW: 'false',
  },
  shell: false,
  stdio: 'inherit',
});

let shuttingDown = false;

function forwardSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (process.platform === 'win32' && child.pid !== undefined) {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  child.kill(signal);
}

function exitCodeForSignal(signal) {
  return signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1;
}

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(exitCodeForSignal(signal));
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`[cockpit-live-e2e] failed to start Vite: ${error.message}`);
  process.exit(1);
});
