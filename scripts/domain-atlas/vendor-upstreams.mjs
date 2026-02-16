import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const atlasRoot = path.join(repoRoot, 'domain-atlas');
const sourcesRoot = path.join(atlasRoot, 'sources');
const upstreamsRoot = path.join(atlasRoot, 'upstreams');

const argv = process.argv.slice(2);
const noClone = argv.includes('--no-clone');
const noWrite = argv.includes('--no-write');
const listOnly = argv.includes('--list');
const refreshRetrievedAt = argv.includes('--refresh-retrieved-at');

function parseOnlyProviders(args) {
  const only = new Set();
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== '--only') continue;

    const value = args[i + 1];
    if (!isNonEmptyString(value)) {
      throw new Error('Missing value for --only (example: --only stripe,keycloak)');
    }

    for (const part of value.split(',')) {
      const id = part.trim();
      if (id.length > 0) only.add(id);
    }

    i += 1;
  }
  return only;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${path.relative(repoRoot, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runGit(args, cwd) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) {
    const stderr = (res.stderr ?? '').trim();
    const stdout = (res.stdout ?? '').trim();
    const details = stderr.length > 0 ? stderr : stdout;
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${details || 'unknown error'}`);
  }
  return (res.stdout ?? '').trim();
}

function nowIsoUtc() {
  return new Date().toISOString();
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readHeadCommit(repoDir) {
  return runGit(['-C', repoDir, 'rev-parse', 'HEAD'], repoRoot);
}

function ensureCheckedOutCommit(repoDir, commit) {
  const current = readHeadCommit(repoDir);
  if (current === commit) return { changed: false };

  // Try checkout first (fast if the commit is already present).
  const checkoutAttempt = spawnSync('git', ['-C', repoDir, 'checkout', '--detach', commit], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (checkoutAttempt.status === 0) {
    return { changed: true };
  }

  // If shallow clone doesn't contain the commit, fetch the commit by hash (best-effort).
  // GitHub supports this; if another remote blocks it, this will surface as an error.
  runGit(['-C', repoDir, 'fetch', '--depth', '1', 'origin', commit], repoRoot);
  runGit(['-C', repoDir, 'checkout', '--detach', commit], repoRoot);

  const after = readHeadCommit(repoDir);
  if (after !== commit) {
    throw new Error(`Failed to checkout pinned commit ${commit} for repo ${repoDir}.`);
  }

  return { changed: true };
}

function main() {
  if (!fs.existsSync(atlasRoot)) {
    throw new Error(`Missing folder: ${path.relative(repoRoot, atlasRoot)}`);
  }
  if (!fs.existsSync(sourcesRoot)) {
    throw new Error(`Missing folder: ${path.relative(repoRoot, sourcesRoot)}`);
  }

  ensureDir(upstreamsRoot);

  const providerDirs = fs
    .readdirSync(sourcesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  if (listOnly) {
    process.stdout.write(`${JSON.stringify({ providers: providerDirs }, null, 2)}\n`);
    return;
  }

  const onlyProviders = parseOnlyProviders(argv);

  const summary = {
    cloned: [],
    checkedOut: [],
    pinned: [],
    skipped: [],
    updatedManifests: [],
  };

  for (const providerDir of providerDirs) {
    if (onlyProviders.size > 0 && !onlyProviders.has(providerDir)) {
      summary.skipped.push({ providerDir, reason: 'excluded (not in --only)' });
      continue;
    }

    const manifestPath = path.join(sourcesRoot, providerDir, 'source.json');
    if (!fs.existsSync(manifestPath)) {
      summary.skipped.push({ providerDir, reason: 'missing source.json' });
      continue;
    }

    const manifest = readJson(manifestPath);
    const providerId = manifest?.providerId;
    const upstream = manifest?.upstream;
    const repoUrl = upstream?.repoUrl;

    if (!isNonEmptyString(providerId) || providerId !== providerDir) {
      summary.skipped.push({ providerDir, reason: 'providerId mismatch' });
      continue;
    }
    if (!isNonEmptyString(repoUrl)) {
      summary.skipped.push({ providerDir, reason: 'missing upstream.repoUrl' });
      continue;
    }

    const destDir = path.join(upstreamsRoot, providerId);
    const desiredCommit = isNonEmptyString(manifest?.upstream?.commit)
      ? String(manifest.upstream.commit).trim()
      : null;

    if (!fs.existsSync(destDir)) {
      if (noClone) {
        summary.skipped.push({ providerDir, reason: 'missing clone (no-clone)' });
        continue;
      }

      // Keep clones lightweight; if a specific commit is required later we can deepen.
      const cloneArgs = ['clone', '--depth', '1', '--no-tags', repoUrl.trim(), destDir];
      runGit(cloneArgs, repoRoot);
      summary.cloned.push(providerId);
    }

    if (!fs.existsSync(destDir)) {
      summary.skipped.push({ providerDir, reason: 'clone missing after clone attempt' });
      continue;
    }

    let checkoutChanged = false;
    if (desiredCommit) {
      const res = ensureCheckedOutCommit(destDir, desiredCommit);
      checkoutChanged = res.changed;
      if (checkoutChanged) summary.checkedOut.push(providerId);
    }

    const commit = readHeadCommit(destDir);
    const commitDate = runGit(['-C', destDir, 'show', '-s', '--format=%cI', 'HEAD'], repoRoot);
    summary.pinned.push({ providerId, commit, commitDate });

    if (!noWrite) {
      const hadCommit = isNonEmptyString(manifest?.upstream?.commit);
      if (!hadCommit) {
        manifest.upstream = { ...manifest.upstream, commit };
        summary.updatedManifests.push(providerId);
      }

      const shouldRefreshRetrievedAt =
        refreshRetrievedAt || checkoutChanged || (!hadCommit && isNonEmptyString(commit));
      if (shouldRefreshRetrievedAt) {
        manifest.upstream = { ...manifest.upstream, retrievedAt: nowIsoUtc() };
      }

      writeJson(manifestPath, manifest);
    }
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
