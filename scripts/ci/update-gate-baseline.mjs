import fs from 'node:fs';
import path from 'node:path';

import { BASELINE_PATH, CRITICAL_GATE_PATHS, sha256FileHex } from './gate-baseline.shared.mjs';

function main() {
  const repoRoot = process.cwd();
  const files = {};

  for (const relPath of CRITICAL_GATE_PATHS) {
    const full = path.join(repoRoot, relPath);
    if (!fs.existsSync(full)) {
      throw new Error(`Critical gate file missing: ${relPath}`);
    }
    files[relPath] = sha256FileHex(repoRoot, relPath);
  }

  const baseline = {
    generatedAt: new Date().toISOString(),
    files,
  };

  const outPath = path.join(repoRoot, BASELINE_PATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
}

main();
