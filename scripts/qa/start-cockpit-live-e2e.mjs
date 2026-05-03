#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const apiBaseUrl =
  process.env.PORTARIUM_LIVE_STACK_API_BASE_URL ??
  process.env.VITE_PORTARIUM_API_BASE_URL ??
  'http://localhost:8080';
const workspaceId = process.env.PORTARIUM_LIVE_STACK_WORKSPACE_ID ?? 'ws-local-dev';

const child = spawn(npmCommand, ['run', '-w', 'apps/cockpit', 'dev:e2e'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    VITE_PORTARIUM_API_BASE_URL: apiBaseUrl,
    VITE_PORTARIUM_CSP_CONNECT_MODE: 'local-only',
    VITE_PORTARIUM_DEFAULT_WORKSPACE_ID: workspaceId,
    VITE_PORTARIUM_ENABLE_MSW: 'false',
  },
  stdio: 'inherit',
});

let shuttingDown = false;

function forwardSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
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
