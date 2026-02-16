import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CRITICAL_GATE_PATHS = [
  // Gate integrity implementation (treat the checker as part of the gate).
  'scripts/ci/check-gate-baseline.mjs',
  'scripts/ci/update-gate-baseline.mjs',
  'scripts/ci/gate-baseline.shared.mjs',
  '.gitattributes',

  '.dependency-cruiser.cjs',
  'eslint.config.mjs',
  'package.json',
  'tsconfig.json',
  'tsconfig.eslint.json',
  'tsconfig.build.json',
  'vitest.config.ts',
  'stryker.conf.json',
  'knip.json',
  'cspell.json',
  '.prettierrc.json',
  '.github/workflows/ci.yml',
  '.github/workflows/nightly.yml',
  '.github/CODEOWNERS',
  '.husky/pre-commit',
  '.husky/pre-push',
  // Claude Code enforcement (added by this repo).
  '.claude/settings.json',
  '.claude/hooks/pre-tool-use.sh',
];

export const BASELINE_PATH = '.ci/gate-baseline.json';

export function sha256FileHex(repoRoot, relPath) {
  const fullPath = path.join(repoRoot, relPath);
  const data = fs.readFileSync(fullPath, 'utf8');
  // Normalize line endings so the baseline is stable across Windows/Linux checkouts.
  const normalized = data.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function readBaseline(repoRoot) {
  const baselineFull = path.join(repoRoot, BASELINE_PATH);
  const raw = fs.readFileSync(baselineFull, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('Baseline JSON must be an object.');
  const files = parsed.files;
  if (!files || typeof files !== 'object') throw new Error('Baseline JSON must contain "files".');
  return { parsed, files };
}
