import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'apps', 'cockpit', 'src', 'assets', 'manifest.json');
const schemaPath = path.join(repoRoot, 'apps', 'cockpit', 'src', 'assets', 'manifest.schema.json');
const publicRoot = path.join(repoRoot, 'apps', 'cockpit', 'public');

function fail(message) {
  console.error(`[cockpit:assets:validate] ${message}`);
  process.exitCode = 1;
}

async function main() {
  const [rawManifest, rawSchema] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(schemaPath, 'utf8'),
  ]);

  const manifest = JSON.parse(rawManifest);
  const schema = JSON.parse(rawSchema);

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(manifest);

  if (!valid) {
    fail('manifest schema validation failed');
    for (const issue of validate.errors ?? []) {
      fail(`${issue.instancePath || '/'} ${issue.message}`);
    }
    return;
  }

  const seen = new Set();
  for (const asset of manifest.assets) {
    if (seen.has(asset.id)) {
      fail(`duplicate asset id: ${asset.id}`);
    }
    seen.add(asset.id);

    if (!asset.decorative && (!asset.alt || asset.alt.trim().length === 0)) {
      fail(`non-decorative asset missing alt text: ${asset.id}`);
    }

    for (const [variant, assetPath] of Object.entries(asset.paths)) {
      if (!assetPath.startsWith('/assets/')) {
        fail(`asset path must start with /assets/: ${asset.id} (${variant})`);
        continue;
      }
      const absolute = path.join(publicRoot, assetPath.replace(/^\/+/, ''));
      if (!existsSync(absolute)) {
        fail(`asset path not found on disk: ${asset.id} -> ${assetPath}`);
      }
    }
  }

  if (process.exitCode) return;

  console.log(`[cockpit:assets:validate] OK (${manifest.assets.length} assets validated)`);
}

await main();
