import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { portariumPlugin } from './index.js';

type OpenClawPluginManifest = Readonly<{
  id: string;
}>;

type PackageManifest = Readonly<{
  repository?: Readonly<{
    directory?: string;
  }>;
}>;

type OpenClawWorkspaceConfig = Readonly<{
  plugins?: Readonly<{
    load?: Readonly<{
      paths?: readonly string[];
    }>;
    entries?: Readonly<Record<string, unknown>>;
  }>;
}>;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('portarium plugin package identity', () => {
  it('keeps the package path, OpenClaw manifest id, and plugin entry id aligned', () => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const openClawManifest = readJson<OpenClawPluginManifest>(
      join(packageRoot, 'openclaw.plugin.json'),
    );
    const packageManifest = readJson<PackageManifest>(join(packageRoot, 'package.json'));

    expect(portariumPlugin.id).toBe('portarium');
    expect(openClawManifest.id).toBe(portariumPlugin.id);
    expect(basename(packageRoot)).toBe(openClawManifest.id);
    expect(packageManifest.repository?.directory).toBe(`packages/${openClawManifest.id}`);
  });

  it('keeps the example OpenClaw workspace config aligned with the plugin identity', () => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const repoRoot = resolve(packageRoot, '..', '..');
    const openClawManifest = readJson<OpenClawPluginManifest>(
      join(packageRoot, 'openclaw.plugin.json'),
    );
    const workspaceConfig = readJson<OpenClawWorkspaceConfig>(
      join(repoRoot, 'examples/openclaw/workspace-config.json'),
    );

    expect(workspaceConfig.plugins?.load?.paths).toContain(
      `<REPO_ROOT>/packages/${openClawManifest.id}`,
    );
    expect(workspaceConfig.plugins?.entries).toHaveProperty(openClawManifest.id);
  });
});
