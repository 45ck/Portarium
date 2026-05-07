#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const forbidden = [
  {
    label: 'private customer name',
    pattern: new RegExp(['mac', 'quarie'].join(''), 'i'),
  },
  {
    label: 'private customer name typo',
    pattern: new RegExp(['mac', 'quaire'].join(''), 'i'),
  },
  {
    label: 'private customer package scope',
    pattern: new RegExp(`@${['mac', 'quarie'].join('-')}-${'college'}`, 'i'),
  },
  {
    label: 'private customer acronym',
    pattern: new RegExp(`\\bm${'q'}c\\b`, 'i'),
  },
  {
    label: 'private customer extension slug',
    pattern: new RegExp(`mc[-_\\s]${'school'}`, 'i'),
  },
];

const allowedFiles = new Set(['scripts/repo/check-customer-boundary.mjs']);
const textLikeExtensions = new Set([
  '',
  '.cjs',
  '.css',
  '.csv',
  '.cts',
  '.env',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.scss',
  '.sh',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

function extensionFor(path) {
  const lastSlash = path.lastIndexOf('/');
  const name = lastSlash === -1 ? path : path.slice(lastSlash + 1);
  const lastDot = name.lastIndexOf('.');
  return lastDot === -1 ? '' : name.slice(lastDot);
}

const trackedFiles = spawnSync('git', ['ls-files', '-z'], {
  encoding: 'utf8',
});

if (trackedFiles.status !== 0) {
  process.stderr.write(trackedFiles.stderr || 'Unable to list tracked files.\n');
  process.exit(trackedFiles.status ?? 1);
}

const findings = [];

for (const file of trackedFiles.stdout.split('\0')) {
  if (!file || allowedFiles.has(file)) continue;
  const extension = extensionFor(file);
  if (!textLikeExtensions.has(extension)) continue;
  if (!statSync(file).isFile()) continue;

  for (const rule of forbidden) {
    if (rule.pattern.test(file)) {
      findings.push(`${file}: path contains ${rule.label}`);
    }
  }

  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;

  const content = bytes.toString('utf8');
  const lines = content.split(/\r?\n/);
  for (const [lineIndex, line] of lines.entries()) {
    for (const rule of forbidden) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(line)) {
        findings.push(`${file}:${lineIndex + 1}: contains ${rule.label}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Portarium customer boundary check failed.');
  console.error(
    'Keep customer-specific names, package scopes, fixtures, and routes in private extension repos.',
  );
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Portarium customer boundary check passed');
