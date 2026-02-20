import type { PackId as PackIdType } from '../primitives/index.js';
import type { PackManifestV1 } from './pack-manifest.js';
import type { PackComplianceProfileV1 } from './pack-compliance-profile-v1.js';

export type PackEnablementComplianceReasonV1 =
  | 'MissingComplianceAssetDeclaration'
  | 'MissingParsedComplianceProfile'
  | 'UndeclaredComplianceAsset'
  | 'PackIdMismatch'
  | 'MissingRequiredComplianceProfile';

export type PackEnablementComplianceAuditV1 = Readonly<{
  packId: PackIdType;
  declaredComplianceAssets: readonly string[];
  validatedProfileIds: readonly string[];
  requiredProfileIds: readonly string[];
  missingRequiredProfileIds: readonly string[];
}>;

export type PackEnablementComplianceAllowedV1 = Readonly<{
  allowed: true;
  audit: PackEnablementComplianceAuditV1;
}>;

export type PackEnablementComplianceDeniedV1 = Readonly<{
  allowed: false;
  reason: PackEnablementComplianceReasonV1;
  audit: PackEnablementComplianceAuditV1;
}>;

export type PackEnablementComplianceDecisionV1 =
  | PackEnablementComplianceAllowedV1
  | PackEnablementComplianceDeniedV1;

export type EvaluatePackEnablementComplianceInputV1 = Readonly<{
  manifest: PackManifestV1;
  parsedProfilesByAsset: Readonly<Record<string, PackComplianceProfileV1>>;
  requiredProfileIds: readonly string[];
}>;

export function evaluatePackEnablementComplianceV1(
  input: EvaluatePackEnablementComplianceInputV1,
): PackEnablementComplianceDecisionV1 {
  const declaredComplianceAssets = [...(input.manifest.assets.complianceProfiles ?? [])];
  const declaredAssetSet = new Set(declaredComplianceAssets);
  const parsedEntries = Object.entries(input.parsedProfilesByAsset);
  const requiredProfileIds = toSortedUnique(input.requiredProfileIds);

  if (requiredProfileIds.length > 0 && declaredComplianceAssets.length === 0) {
    return deny(
      'MissingComplianceAssetDeclaration',
      input.manifest.id,
      declaredComplianceAssets,
      [],
      requiredProfileIds,
    );
  }

  for (const [assetPath] of parsedEntries) {
    if (!declaredAssetSet.has(assetPath)) {
      return deny(
        'UndeclaredComplianceAsset',
        input.manifest.id,
        declaredComplianceAssets,
        [],
        requiredProfileIds,
      );
    }
  }

  const validatedProfileIds: string[] = [];
  for (const declaredAsset of declaredComplianceAssets) {
    const profile = input.parsedProfilesByAsset[declaredAsset];
    if (profile === undefined) {
      return deny(
        'MissingParsedComplianceProfile',
        input.manifest.id,
        declaredComplianceAssets,
        validatedProfileIds,
        requiredProfileIds,
      );
    }

    if (profile.packId !== input.manifest.id) {
      return deny(
        'PackIdMismatch',
        input.manifest.id,
        declaredComplianceAssets,
        validatedProfileIds,
        requiredProfileIds,
      );
    }

    validatedProfileIds.push(String(profile.profileId));
  }

  const uniqueValidatedProfileIds = toSortedUnique(validatedProfileIds);
  const missingRequiredProfileIds = requiredProfileIds.filter(
    (requiredId) => !uniqueValidatedProfileIds.includes(requiredId),
  );
  if (missingRequiredProfileIds.length > 0) {
    return deny(
      'MissingRequiredComplianceProfile',
      input.manifest.id,
      declaredComplianceAssets,
      uniqueValidatedProfileIds,
      requiredProfileIds,
      missingRequiredProfileIds,
    );
  }

  return {
    allowed: true,
    audit: buildAudit(
      input.manifest.id,
      declaredComplianceAssets,
      uniqueValidatedProfileIds,
      requiredProfileIds,
      [],
    ),
  };
}

function deny(
  reason: PackEnablementComplianceReasonV1,
  packId: PackIdType,
  declaredComplianceAssets: readonly string[],
  validatedProfileIds: readonly string[],
  requiredProfileIds: readonly string[],
  missingRequiredProfileIds: readonly string[] = [],
): PackEnablementComplianceDeniedV1 {
  return {
    allowed: false,
    reason,
    audit: buildAudit(
      packId,
      declaredComplianceAssets,
      validatedProfileIds,
      requiredProfileIds,
      missingRequiredProfileIds,
    ),
  };
}

function buildAudit(
  packId: PackIdType,
  declaredComplianceAssets: readonly string[],
  validatedProfileIds: readonly string[],
  requiredProfileIds: readonly string[],
  missingRequiredProfileIds: readonly string[],
): PackEnablementComplianceAuditV1 {
  return {
    packId,
    declaredComplianceAssets: [...declaredComplianceAssets],
    validatedProfileIds: [...validatedProfileIds],
    requiredProfileIds: [...requiredProfileIds],
    missingRequiredProfileIds: [...missingRequiredProfileIds],
  };
}

function toSortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
