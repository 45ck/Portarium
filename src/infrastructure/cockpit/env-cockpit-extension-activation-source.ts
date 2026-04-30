import type {
  CockpitExtensionActivationSource,
  CockpitExtensionActivationState,
} from '../../application/ports/cockpit-extension-activation-source.js';

export type EnvCockpitExtensionActivationSourceConfig = Readonly<{
  grants: readonly EnvCockpitExtensionActivationGrant[];
}>;

export type EnvCockpitExtensionActivationGrant = Readonly<{
  workspaceIds?: readonly string[];
  principalIds?: readonly string[];
  roleIncludes?: readonly string[];
  scopeIncludes?: readonly string[];
  activePackIds?: readonly string[];
  quarantinedExtensionIds?: readonly string[];
  availableCapabilities?: readonly string[];
  availableApiScopes?: readonly string[];
}>;

export class EnvCockpitExtensionActivationSource implements CockpitExtensionActivationSource {
  readonly #grants: readonly EnvCockpitExtensionActivationGrant[];

  public constructor(config: EnvCockpitExtensionActivationSourceConfig) {
    this.#grants = config.grants.map(normalizeGrant).filter(isScopedGrant);
  }

  public getActivationState(
    query: Parameters<CockpitExtensionActivationSource['getActivationState']>[0],
  ): Promise<CockpitExtensionActivationState> {
    const matchingGrants = this.#grants.filter((grant) => matchesGrant(grant, query));

    return Promise.resolve({
      activePackIds: mergeGrantLists(matchingGrants, 'activePackIds'),
      quarantinedExtensionIds: mergeGrantLists(matchingGrants, 'quarantinedExtensionIds'),
      availableCapabilities: mergeGrantLists(matchingGrants, 'availableCapabilities'),
      availableApiScopes: mergeGrantLists(matchingGrants, 'availableApiScopes'),
    });
  }
}

export function buildEnvCockpitExtensionActivationSource(
  env: Record<string, string | undefined> = process.env,
): CockpitExtensionActivationSource {
  return new EnvCockpitExtensionActivationSource({
    grants: parseGrantList(env['PORTARIUM_COCKPIT_EXTENSION_GRANTS_JSON']),
  });
}

function parseGrantList(value: string | undefined): readonly EnvCockpitExtensionActivationGrant[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGrantRecord).map((grant) => ({
      workspaceIds: readStringList(grant, 'workspaceIds'),
      principalIds: readStringList(grant, 'principalIds'),
      roleIncludes: readStringList(grant, 'roleIncludes'),
      scopeIncludes: readStringList(grant, 'scopeIncludes'),
      activePackIds: readStringList(grant, 'activePackIds'),
      quarantinedExtensionIds: readStringList(grant, 'quarantinedExtensionIds'),
      availableCapabilities: readStringList(grant, 'availableCapabilities'),
      availableApiScopes: readStringList(grant, 'availableApiScopes'),
    }));
  } catch {
    return [];
  }
}

function isGrantRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStringList(
  grant: Record<string, unknown>,
  key: keyof EnvCockpitExtensionActivationGrant,
): readonly string[] {
  const value = grant[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeGrant(
  grant: EnvCockpitExtensionActivationGrant,
): EnvCockpitExtensionActivationGrant {
  return {
    workspaceIds: normalizeList(grant.workspaceIds ?? []),
    principalIds: normalizeList(grant.principalIds ?? []),
    roleIncludes: normalizeList(grant.roleIncludes ?? []),
    scopeIncludes: normalizeList(grant.scopeIncludes ?? []),
    activePackIds: normalizeList(grant.activePackIds ?? []),
    quarantinedExtensionIds: normalizeList(grant.quarantinedExtensionIds ?? []),
    availableCapabilities: normalizeList(grant.availableCapabilities ?? []),
    availableApiScopes: normalizeList(grant.availableApiScopes ?? []),
  };
}

function isScopedGrant(grant: EnvCockpitExtensionActivationGrant): boolean {
  return Boolean(grant.workspaceIds?.length);
}

function matchesGrant(
  grant: EnvCockpitExtensionActivationGrant,
  query: Parameters<CockpitExtensionActivationSource['getActivationState']>[0],
): boolean {
  return (
    matchesOptionalList(grant.workspaceIds, query.workspaceId) &&
    matchesOptionalList(grant.principalIds, query.principalId) &&
    containsAll(query.roles, grant.roleIncludes) &&
    containsAll(query.scopes, grant.scopeIncludes)
  );
}

function matchesOptionalList(values: readonly string[] | undefined, candidate: string): boolean {
  return !values || values.length === 0 || values.includes(candidate);
}

function containsAll(haystack: readonly string[], needles: readonly string[] | undefined): boolean {
  if (!needles || needles.length === 0) return true;
  const haystackSet = new Set(haystack);
  return needles.every((needle) => haystackSet.has(needle));
}

function mergeGrantLists(
  grants: readonly EnvCockpitExtensionActivationGrant[],
  key: keyof Pick<
    EnvCockpitExtensionActivationGrant,
    'activePackIds' | 'quarantinedExtensionIds' | 'availableCapabilities' | 'availableApiScopes'
  >,
): readonly string[] {
  return normalizeList(grants.flatMap((grant) => grant[key] ?? []));
}

function normalizeList(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}
