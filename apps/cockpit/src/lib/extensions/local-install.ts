import type { CockpitInstalledExtension, CockpitExtensionRegistryProblem } from './types';

interface LocalInstallModule {
  default?: unknown;
  installedExtensions?: unknown;
}

interface LocalInstallCollection {
  extensions: readonly CockpitInstalledExtension[];
  problems: readonly CockpitExtensionRegistryProblem[];
}

type LocalInstallModuleLoader = () => Promise<LocalInstallModule>;

const localInstallCollection = await loadConfiguredLocalInstallModules();

export const LOCAL_COCKPIT_EXTENSION_MODULES = localInstallCollection.extensions;

export const LOCAL_COCKPIT_EXTENSION_INSTALL_PROBLEMS = localInstallCollection.problems;

export const LOCAL_COCKPIT_EXTENSION_FIXTURE_ACCESS_ENABLED =
  isLocalExtensionFixtureAccessEnabled();

async function loadConfiguredLocalInstallModules(): Promise<LocalInstallCollection> {
  if (!isLocalExtensionInstallEnabled()) return { extensions: [], problems: [] };

  const discoveredLocalInstallModuleLoaders = import.meta.glob<LocalInstallModule>(
    './local-installed/*.local.ts',
  );
  return loadLocalInstallModules(discoveredLocalInstallModuleLoaders, { enabled: true });
}

export async function loadLocalInstallModules(
  moduleLoaders: Readonly<Record<string, LocalInstallModuleLoader>>,
  options: { enabled: boolean },
): Promise<LocalInstallCollection> {
  if (!options.enabled) return { extensions: [], problems: [] };

  const extensions: CockpitInstalledExtension[] = [];
  const problems: CockpitExtensionRegistryProblem[] = [];

  for (const [modulePath, loadModule] of Object.entries(moduleLoaders).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    try {
      const collection = collectLocalInstallModules({ [modulePath]: await loadModule() });
      extensions.push(...collection.extensions);
      problems.push(...collection.problems);
    } catch (error) {
      problems.push({
        code: 'invalid-manifest',
        message: `Local Cockpit extension install module "${modulePath}" failed to load: ${toErrorMessage(error)}`,
        itemId: modulePath,
      });
    }
  }

  return { extensions, problems };
}

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
  const env = localExtensionEnv();
  if (import.meta.env.MODE === 'test') {
    return env['VITE_COCKPIT_ENABLE_LOCAL_EXTENSIONS_IN_TESTS'] === 'true';
  }

  return env['VITE_COCKPIT_ENABLE_LOCAL_EXTENSIONS'] === 'true';
}

function isLocalExtensionFixtureAccessEnabled(): boolean {
  const env = localExtensionEnv();
  if (import.meta.env.MODE === 'test') {
    return env['VITE_COCKPIT_ENABLE_LOCAL_EXTENSION_FIXTURE_ACCESS_IN_TESTS'] === 'true';
  }

  return env['VITE_COCKPIT_ENABLE_LOCAL_EXTENSION_FIXTURE_ACCESS'] === 'true';
}

function localExtensionEnv(): ImportMetaEnv & Readonly<Record<string, string | undefined>> {
  return import.meta.env as ImportMetaEnv & Readonly<Record<string, string | undefined>>;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
