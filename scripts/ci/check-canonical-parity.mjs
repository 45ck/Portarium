#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const wantsJson = process.argv.includes('--json');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');

if (wantsHelp) {
  console.log('check-canonical-parity');
  console.log('Usage: node scripts/ci/check-canonical-parity.mjs [--json] [--help]');
  console.log('Runs canonical spec and docs parity checks.');
  process.exit(0);
}

const checks = [
  {
    label: 'spec-parity',
    path: fileURLToPath(new URL('./check-canonical-spec-parity.mjs', import.meta.url)),
  },
  {
    label: 'docs-parity',
    path: fileURLToPath(new URL('./check-canonical-docs-parity.mjs', import.meta.url)),
  },
];

const args = wantsJson ? ['--json'] : [];
const results = checks.map(({ label, path }) => {
  const result = spawnSync(process.execPath, [path, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  return {
    label,
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
});

const failed = results.find((result) => result.status !== 0);

if (wantsJson) {
  console.log(
    JSON.stringify(
      {
        status: failed ? 'fail' : 'ok',
        checks: results.map((result) => ({
          label: result.label,
          status: result.status === 0 ? 'ok' : 'fail',
          output: result.stdout,
          error: result.stderr || null,
        })),
      },
      null,
      2,
    ),
  );
} else {
  for (const result of results) {
    if (result.stdout) {
      console.log(result.stdout);
    }
    if (result.stderr) {
      console.error(result.stderr);
    }
  }
}

if (failed) {
  process.exit(1);
}
