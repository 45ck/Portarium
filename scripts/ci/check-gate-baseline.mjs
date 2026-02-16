import fs from 'node:fs';
import path from 'node:path';

import {
  BASELINE_PATH,
  CRITICAL_GATE_PATHS,
  readBaseline,
  sha256FileHex,
} from './gate-baseline.shared.mjs';

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}

function main() {
  const repoRoot = process.cwd();

  const baselineFull = path.join(repoRoot, BASELINE_PATH);
  if (!fs.existsSync(baselineFull)) {
    fail(
      [
        `Missing ${BASELINE_PATH}.`,
        'Run: npm run ci:gates:update-baseline',
        'Then commit the updated baseline alongside any gate changes and an ADR explaining why.',
      ].join('\n'),
    );
  }

  const { files: baselineFiles } = readBaseline(repoRoot);

  const baselineKeys = new Set(Object.keys(baselineFiles));
  const expectedKeys = new Set(CRITICAL_GATE_PATHS);

  const missing = CRITICAL_GATE_PATHS.filter((p) => !baselineKeys.has(p));
  const extra = [...baselineKeys].filter((p) => !expectedKeys.has(p));

  if (missing.length > 0 || extra.length > 0) {
    fail(
      [
        `${BASELINE_PATH} is out of sync with the expected critical file list.`,
        missing.length > 0 ? `Missing entries: ${missing.join(', ')}` : '',
        extra.length > 0 ? `Extra entries: ${extra.join(', ')}` : '',
        'Run: npm run ci:gates:update-baseline',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  const mismatches = [];

  for (const relPath of CRITICAL_GATE_PATHS) {
    const full = path.join(repoRoot, relPath);
    if (!fs.existsSync(full)) {
      mismatches.push({ path: relPath, reason: 'missing' });
      continue;
    }

    const expected = String(baselineFiles[relPath] ?? '');
    const actual = sha256FileHex(repoRoot, relPath);
    if (expected !== actual) {
      mismatches.push({ path: relPath, reason: 'hash_mismatch', expected, actual });
    }
  }

  if (mismatches.length > 0) {
    const lines = [
      'Gate integrity check failed.',
      '',
      'Critical gate files changed without updating the baseline.',
      'Update the baseline and add an ADR for any gate/threshold changes:',
      '  npm run ci:gates:update-baseline',
      '',
      'Mismatches:',
      ...mismatches.map((m) => `- ${m.path} (${m.reason})`),
    ];
    fail(lines.join('\n'));
  }
}

main();
