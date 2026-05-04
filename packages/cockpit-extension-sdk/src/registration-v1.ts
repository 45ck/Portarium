import {
  assertCockpitExtensionManifestV1Conforms,
  type CockpitExtensionManifestConformanceReport,
} from './conformance.js';
import type {
  CockpitExtensionDataScopeRef,
  CockpitExtensionManifestV1,
  CockpitExtensionPackageRef,
  CockpitExtensionPermissionGrant,
  CockpitExtensionRouteModuleRef,
  CockpitInstalledExtension,
  CockpitWorkspacePackActivationRef,
} from './manifest-v1.js';

export interface CockpitExtensionReadOnlyPermissionMetadataV1 {
  extensionId: string;
  dataScopeId: string;
  permissionGrantId: string;
  title: string;
  resource: string;
  requiredCapabilities: readonly string[];
  requiredApiScopes: readonly string[];
  privacyClasses: readonly string[];
  auditEventTypes: readonly string[];
}

export interface CockpitExtensionRegistrationV1<
  TManifest extends CockpitExtensionManifestV1 = CockpitExtensionManifestV1,
  TRouteModuleRef extends CockpitExtensionRouteModuleRef<unknown, unknown, TManifest> =
    CockpitExtensionRouteModuleRef<unknown, unknown, TManifest>,
> extends CockpitInstalledExtension<TManifest, TRouteModuleRef> {
  conformance: CockpitExtensionManifestConformanceReport;
  readOnlyPermissions: readonly CockpitExtensionReadOnlyPermissionMetadataV1[];
}

export interface CockpitExtensionRegistrationInputV1<
  TManifest extends CockpitExtensionManifestV1 = CockpitExtensionManifestV1,
  TRouteModuleRef extends CockpitExtensionRouteModuleRef<unknown, unknown, TManifest> =
    CockpitExtensionRouteModuleRef<unknown, unknown, TManifest>,
> {
  manifest: TManifest;
  routeModules: readonly TRouteModuleRef[];
  packageRef: CockpitExtensionPackageRef;
  workspacePackRefs: readonly CockpitWorkspacePackActivationRef[];
}

export function createCockpitExtensionRegistrationV1<
  TManifest extends CockpitExtensionManifestV1,
  TRouteModuleRef extends CockpitExtensionRouteModuleRef<unknown, unknown, TManifest>,
>({
  manifest,
  routeModules,
  packageRef,
  workspacePackRefs,
}: CockpitExtensionRegistrationInputV1<TManifest, TRouteModuleRef>): CockpitExtensionRegistrationV1<
  TManifest,
  TRouteModuleRef
> {
  const conformance = assertCockpitExtensionManifestV1Conforms({
    manifest,
    packageRef,
    workspacePackRefs,
    routeModuleIds: routeModules.map((routeModule) => routeModule.routeId),
  });

  return {
    manifest,
    routeModules,
    packageRef,
    workspacePackRefs,
    conformance,
    readOnlyPermissions: createCockpitExtensionReadOnlyPermissionMetadataV1(manifest),
  };
}

export function createCockpitExtensionReadOnlyPermissionMetadataV1(
  manifest: CockpitExtensionManifestV1,
): readonly CockpitExtensionReadOnlyPermissionMetadataV1[] {
  const grants = new Map(manifest.governance.permissions.map((grant) => [grant.id, grant]));
  return (manifest.dataScopes ?? []).flatMap((scope) =>
    scope.permissionGrantIds.flatMap((grantId) => {
      const grant = grants.get(grantId);
      if (!grant || !isReadOnlyDataGrant(grant)) return [];
      return [createReadOnlyPermissionMetadata(manifest.id, scope, grant)];
    }),
  );
}

function createReadOnlyPermissionMetadata(
  extensionId: string,
  scope: CockpitExtensionDataScopeRef,
  grant: CockpitExtensionPermissionGrant,
): CockpitExtensionReadOnlyPermissionMetadataV1 {
  return {
    extensionId,
    dataScopeId: scope.id,
    permissionGrantId: grant.id,
    title: scope.title,
    resource: scope.resource,
    requiredCapabilities: uniqueStrings([
      ...scope.guard.requiredCapabilities,
      ...grant.requiredCapabilities,
    ]),
    requiredApiScopes: uniqueStrings([
      ...scope.guard.requiredApiScopes,
      ...grant.requiredApiScopes,
    ]),
    privacyClasses: scope.guard.privacyClasses ?? [],
    auditEventTypes: grant.auditEventTypes,
  };
}

function isReadOnlyDataGrant(grant: CockpitExtensionPermissionGrant): boolean {
  return (
    grant.kind === 'data-query' &&
    grant.policySemantics === 'authorization-required' &&
    grant.evidenceSemantics === 'read-audited-by-control-plane'
  );
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
