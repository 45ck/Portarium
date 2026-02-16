import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const manifestPath = path.join(repoRoot, 'research', 'manifest.json');
const pinsPath = path.join(repoRoot, 'research', 'pins.json');
const sourcesDir = path.join(repoRoot, 'research', 'sources');
const notesTemplatePath = path.join(
  repoRoot,
  'docs',
  'research',
  'templates',
  'source-notes.template.md',
);

const argv = process.argv.slice(2);
const noClone = argv.includes('--no-clone');

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
  // Stable + diff-friendly timestamps in committed pins.
  return new Date().toISOString();
}

function validateId(id) {
  if (typeof id !== 'string' || id.trim().length === 0) return false;
  return /^[a-z0-9][a-z0-9-]*$/.test(id);
}

function renderTemplate(template, vars) {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    return String(vars[key] ?? '');
  });
}

function normalizeNotesPath(source) {
  if (typeof source.notesPath === 'string' && source.notesPath.trim().length > 0) {
    return source.notesPath.trim();
  }
  return path.posix.join('docs', 'research', 'sources', `${source.id}.md`);
}

function sortObjectByKey(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

function main() {
  ensureDir(sourcesDir);

  const manifest = readJson(manifestPath);
  if (manifest?.version !== 1 || !Array.isArray(manifest.sources)) {
    throw new Error(`Invalid manifest format: ${path.relative(repoRoot, manifestPath)}`);
  }

  const pins = readJson(pinsPath);
  if (pins?.version !== 1 || pins.pinned === undefined || typeof pins.pinned !== 'object') {
    throw new Error(`Invalid pins format: ${path.relative(repoRoot, pinsPath)}`);
  }

  const template = fs.readFileSync(notesTemplatePath, 'utf8');

  const seenIds = new Set();
  const sources = manifest.sources;
  for (const source of sources) {
    if (!validateId(source?.id)) {
      throw new Error(
        `Invalid source id (must be kebab-case): ${JSON.stringify(source?.id ?? null)}`,
      );
    }
    if (seenIds.has(source.id)) throw new Error(`Duplicate source id: ${source.id}`);
    seenIds.add(source.id);

    if (typeof source.repo !== 'string' || source.repo.trim().length === 0) {
      throw new Error(`Missing repo for source: ${source.id}`);
    }
    if (typeof source.name !== 'string' || source.name.trim().length === 0) {
      throw new Error(`Missing name for source: ${source.id}`);
    }
  }

  // Prune pins for sources removed from the manifest to keep the file tidy.
  for (const pinnedId of Object.keys(pins.pinned)) {
    if (!seenIds.has(pinnedId)) {
      delete pins.pinned[pinnedId];
    }
  }

  const created = [];
  const updatedPins = [];

  for (const source of sources) {
    const destDir = path.join(sourcesDir, source.id);

    if (!fs.existsSync(destDir)) {
      if (noClone) {
        continue;
      }

      const cloneArgs = ['clone', '--depth', '1', '--no-tags'];
      if (typeof source.ref === 'string' && source.ref.trim().length > 0) {
        cloneArgs.push('--branch', source.ref.trim(), '--single-branch');
      }
      cloneArgs.push(source.repo.trim(), destDir);
      runGit(cloneArgs, repoRoot);
      created.push(source.id);
    }

    if (!fs.existsSync(destDir)) {
      continue;
    }

    const commit = runGit(['-C', destDir, 'rev-parse', 'HEAD'], repoRoot);
    const commitDate = runGit(['-C', destDir, 'show', '-s', '--format=%cI', 'HEAD'], repoRoot);

    pins.pinned[source.id] = {
      name: source.name,
      repo: source.repo.trim(),
      ref:
        typeof source.ref === 'string' && source.ref.trim().length > 0 ? source.ref.trim() : null,
      commit,
      commitDate,
      syncedAt: nowIsoUtc(),
    };
    updatedPins.push(source.id);

    const notesPath = normalizeNotesPath(source);
    const absNotesPath = path.join(repoRoot, notesPath);
    ensureDir(path.dirname(absNotesPath));

    if (!fs.existsSync(absNotesPath)) {
      const pinned = commit.length > 0 ? commit : 'TBD';
      const content = renderTemplate(template, {
        id: source.id,
        name: source.name,
        repo: source.repo.trim(),
        pinned,
      });
      fs.writeFileSync(absNotesPath, content, 'utf8');
    }
  }

  pins.pinned = sortObjectByKey(pins.pinned);
  writeJson(pinsPath, pins);

  process.stdout.write(
    JSON.stringify(
      {
        cloned: created,
        pinned: updatedPins,
        pinsFile: path.relative(repoRoot, pinsPath),
      },
      null,
      2,
    ) + '\n',
  );
}

main();
