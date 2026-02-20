import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.conf',
  '.cts',
  '.env',
  '.js',
  '.json',
  '.mjs',
  '.mts',
  '.ps1',
  '.sh',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const SCAN_PATH_PREFIXES = ['.claude/', '.github/', '.husky/', 'apps/', 'scripts/', 'src/'];

const SCAN_FILE_NAMES = new Set([
  '.env',
  '.env.example',
  '.env.local',
  '.env.production',
  '.env.staging',
  '.env.test',
]);

const SECRET_PATTERNS = [
  { name: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'aws-access-key-id', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g },
  { name: 'npm-token', pattern: /\bnpm_[A-Za-z0-9]{30,}\b/g },
  { name: 'google-api-key', pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  { name: 'stripe-live-secret', pattern: /\bsk_live_[0-9A-Za-z]{16,}\b/g },
  { name: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function listTrackedFiles() {
  const stdout = execSync('git ls-files', { encoding: 'utf8' });
  return stdout
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);
}

function shouldScan(relPath) {
  if (SCAN_FILE_NAMES.has(path.basename(relPath))) return true;
  if (!SCAN_PATH_PREFIXES.some((prefix) => relPath.startsWith(prefix))) return false;
  return TEXT_EXTENSIONS.has(path.extname(relPath).toLowerCase());
}

function detectSecretsInFile(absolutePath, relPath) {
  const raw = fs.readFileSync(absolutePath, 'utf8');
  if (raw.includes('\u0000')) return [];

  const findings = [];
  const lines = raw.split(/\r?\n/u);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;

    for (const { name, pattern } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      if (!pattern.test(line)) continue;

      findings.push({
        path: relPath,
        line: i + 1,
        detector: name,
      });
    }
  }

  return findings;
}

function main() {
  const repoRoot = process.cwd();
  const files = listTrackedFiles();
  const findings = [];

  for (const relPath of files) {
    if (!shouldScan(relPath)) continue;

    const fullPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(fullPath)) continue;

    findings.push(...detectSecretsInFile(fullPath, relPath));
  }

  if (findings.length > 0) {
    fail(
      [
        `Secret scan failed with ${findings.length} potential secret findings:`,
        ...findings.map((f) => `- ${f.path}:${f.line} [${f.detector}]`),
      ].join('\n'),
    );
  }

  console.log(`Secret scan passed across ${files.length} tracked files.`);
}

main();
