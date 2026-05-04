import type { CockpitInstalledExtension, CockpitExtensionRegistryProblem } from './types';

interface LocalInstallModule {
  default?: unknown;
  installedExtensions?: unknown;
}

interface LocalInstallCollection {
  extensions: readonly CockpitInstalledExtension[];
  problems: readonly CockpitExtensionRegistryProblem[];
}

const discoveredLocalInstallModules = import.meta.glob<LocalInstallModule>(
  './local-installed/*.local.ts',
  {
    eager: true,
  },
);
const localInstallModules = isLocalExtensionInstallEnabled() ? discoveredLocalInstallModules : {};

const localInstallCollection = collectLocalInstallModules(localInstallModules);

export const LOCAL_COCKPIT_EXTENSION_MODULES = localInstallCollection.extensions;

export const LOCAL_COCKPIT_EXTENSION_INSTALL_PROBLEMS = localInstallCollection.problems;

export function collectLocalInstallModules(
  modules: Readonly<Record<string, LocalInstallModule>>,
): LocalInstallCollection {
  const extensions: CockpitInstalledExtension[] = [];
  const problems: CockpitExtensionRegistryProblem[] = [];

  for (const [modulePath, module] of Object.entries(modules).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const candidates = normalizeLocalInstallCandidates(
      module.default ?? module.installedExtensions,
    );
    if (candidates.length === 0) {
      problems.push({
        code: 'invalid-manifest',
        message: `Local Cockpit extension install module "${modulePath}" must export an installed extension or an array of installed extensions.`,
        itemId: modulePath,
      });
      continue;
    }

    for (const candidate of candidates) {
      if (isInstalledExtension(candidate)) {
        extensions.push(candidate);
        continue;
      }

      problems.push({
        code: 'invalid-manifest',
        message: `Local Cockpit extension install module "${modulePath}" exported an invalid installed extension record.`,
        itemId: modulePath,
      });
    }
  }

  return { extensions, problems };
}

function normalizeLocalInstallCandidates(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function isInstalledExtension(value: unknown): value is CockpitInstalledExtension {
  if (!value || typeof value !== 'object') return false;

  const record = value as Partial<CockpitInstalledExtension>;
  return (
    Boolean(record.manifest) &&
    Array.isArray(record.routeModules) &&
    Boolean(record.packageRef) &&
    Array.isArray(record.workspacePackRefs)
  );
}

function isLocalExtensionInstallEnabled(): boolean {
  if (import.meta.env.MODE === 'test') {
    return import.meta.env['VITE_COCKPIT_ENABLE_LOCAL_EXTENSIONS_IN_TESTS'] === 'true';
  }

  return import.meta.env['VITE_COCKPIT_ENABLE_LOCAL_EXTENSIONS'] === 'true';
}
