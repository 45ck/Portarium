#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = parseArgs(process.argv.slice(2));
const workspaceDir = resolve(process.env['MICRO_SAAS_WORKSPACE_DIR'] ?? process.cwd());
const outputPath = resolve(workspaceDir, args.output ?? 'outputs/content-machine-script.json');
const logPath = resolve(workspaceDir, args.log ?? 'outputs/content-machine-script.log');
const topic = args.topic ?? 'Prompt Review Copilot launch';
const contentMachineRepo =
  process.env['CONTENT_MACHINE_REPO'] ?? 'D:/Visual Studio Projects/content-machine';
const tsxCli = process.env['VAOP_TSX_CLI'];

if (!tsxCli) {
  throw new Error('VAOP_TSX_CLI is required');
}

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(logPath), { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    tsxCli,
    resolve(contentMachineRepo, 'src', 'cli', 'index.ts'),
    'script',
    '--topic',
    topic,
    '--mock',
    '--output',
    outputPath,
  ],
  {
    cwd: workspaceDir,
    env: {
      ...process.env,
    },
    encoding: 'utf8',
  },
);

const combinedLog = [result.stdout ?? '', result.stderr ?? ''].filter(Boolean).join('\n').trim();
writeFileSync(logPath, `${combinedLog}\n`, 'utf8');

if (result.status !== 0) {
  console.error(`MICRO_SAAS_TOOL content-machine failed exitCode=${String(result.status)}`);
  if (combinedLog) {
    console.error(combinedLog);
  }
  process.exit(result.status ?? 1);
}

console.log(
  [
    'MICRO_SAAS_TOOL content-machine',
    `topic="${topic}"`,
    `output="${outputPath}"`,
    `log="${logPath}"`,
    `exitCode=${String(result.status)}`,
  ].join(' '),
);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}
