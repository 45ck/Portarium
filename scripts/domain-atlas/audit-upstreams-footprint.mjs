import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const upstreamsRoot = path.join(repoRoot, 'domain-atlas', 'upstreams');
const sourcesRoot = path.join(repoRoot, 'domain-atlas', 'sources');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const failOnOrphans = args.includes('--fail-on-orphans');
const maxTotalMb = readNumericArg(args, '--max-total-mb');
const maxProviderMb = readNumericArg(args, '--max-provider-mb');

function readNumericArg(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return null;
  const value = argv[idx + 1];
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectProviderIds() {
  if (!fs.existsSync(sourcesRoot)) return new Set();
  const dirs = fs.readdirSync(sourcesRoot, { withFileTypes: true });
  return new Set(dirs.filter((d) => d.isDirectory()).map((d) => d.name));
}

function scanDirectoryFootprint(dirPath) {
  let bytes = 0;
  let files = 0;
  if (!fs.existsSync(dirPath)) return { bytes, files };
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(abs).size;
      }
    }
  }
  return { bytes, files };
}

if (!fs.existsSync(upstreamsRoot)) {
  console.error(`Missing folder: ${path.relative(repoRoot, upstreamsRoot)}`);
  process.exit(1);
}

const providerIds = collectProviderIds();
const rows = fs
  .readdirSync(upstreamsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const name = d.name;
    const abs = path.join(upstreamsRoot, name);
    const stats = scanDirectoryFootprint(abs);
    return {
      providerId: name,
      files: stats.files,
      mb: Number((stats.bytes / (1024 * 1024)).toFixed(2)),
      inSourcesManifest: providerIds.has(name),
    };
  })
  .sort((a, b) => b.mb - a.mb);

const totals = rows.reduce(
  (acc, row) => {
    acc.mb += row.mb;
    acc.files += row.files;
    return acc;
  },
  { mb: 0, files: 0 },
);
totals.mb = Number(totals.mb.toFixed(2));

const orphans = rows.filter((row) => !row.inSourcesManifest).map((row) => row.providerId);
const overProviderLimit =
  typeof maxProviderMb === 'number' ? rows.filter((row) => row.mb > maxProviderMb) : [];
const totalOverLimit = typeof maxTotalMb === 'number' ? totals.mb > maxTotalMb : false;

if (jsonOutput) {
  process.stdout.write(
    `${JSON.stringify(
      {
        rows,
        totals,
        checks: {
          maxTotalMb,
          maxProviderMb,
          totalOverLimit,
          overProviderLimit: overProviderLimit.map((r) => r.providerId),
          orphanProviders: orphans,
        },
      },
      null,
      2,
    )}\n`,
  );
} else {
  console.log('Domain Atlas upstream footprint');
  console.log('providerId | files | mb | inSourcesManifest');
  for (const row of rows) {
    console.log(
      `${row.providerId} | ${row.files} | ${row.mb.toFixed(2)} | ${row.inSourcesManifest ? 'yes' : 'no'}`,
    );
  }
  console.log(`\nTotal providers: ${rows.length}`);
  console.log(`Total files: ${totals.files}`);
  console.log(`Total MB: ${totals.mb.toFixed(2)}`);
  if (orphans.length > 0) {
    console.log(`Orphan provider dirs: ${orphans.join(', ')}`);
  }
}

const failures = [];
if (totalOverLimit) failures.push(`total upstream footprint ${totals.mb.toFixed(2)} MB exceeds ${maxTotalMb} MB`);
if (overProviderLimit.length > 0) {
  failures.push(
    `providers exceed ${maxProviderMb} MB: ${overProviderLimit.map((r) => `${r.providerId} (${r.mb.toFixed(2)} MB)`).join(', ')}`,
  );
}
if (failOnOrphans && orphans.length > 0) {
  failures.push(`orphan provider dirs detected: ${orphans.join(', ')}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

