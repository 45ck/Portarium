import { spawn } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const e2e = args.includes('--e2e');
const passthrough = args.filter((arg) => arg !== '--e2e');

let command = 'npm';
let commandArgs = ['run', '-w', 'apps/cockpit', 'dev'];
let cwd = process.cwd();

if (e2e) {
  command = 'npx';
  commandArgs = ['vite', '--port', '5173', '--strictPort', ...passthrough];
  cwd = path.resolve(process.cwd(), 'apps/cockpit');
} else if (passthrough.length > 0) {
  commandArgs = [...commandArgs, '--', ...passthrough];
}

const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  shell: true,
  cwd,
  env: {
    ...process.env,
    VITE_DEMO_MODE: process.env.VITE_DEMO_MODE ?? 'true',
    VITE_PORTARIUM_ENABLE_MSW: process.env.VITE_PORTARIUM_ENABLE_MSW ?? 'true',
    VITE_PORTARIUM_MOCK_DATASET: process.env.VITE_PORTARIUM_MOCK_DATASET ?? 'openclaw-demo',
  },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
