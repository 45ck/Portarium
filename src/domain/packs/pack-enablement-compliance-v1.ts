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

type ComplianceAuditInput = Readonly<{
  packId: PackIdType;
  declaredComplianceAssets: readonly string[];
  validatedProfileIds: readonly string[];
  requiredProfileIds: readonly string[];
}>;

type ComplianceEvaluationState = Readonly<{
  packId: PackIdType;
  declaredComplianceAssets: readonly string[];
  declaredAssetSet: ReadonlySet<string>;
  parsedEntries: readonly (readonly [string, PackComplianceProfileV1])[];
  requiredProfileIds: readonly string[];
}>;

type ProfileCollectionResult =
  | Readonly<{ ok: true; validatedProfileIds: readonly string[] }>
  | Readonly<{ ok: false; decision: PackEnablementComplianceDecisionV1 }>;

export function evaluatePackEnablementComplianceV1(
  input: EvaluatePackEnablementComplianceInputV1,
): PackEnablementComplianceDecisionV1 {
  const state = createComplianceEvaluationState(input);
  const declarationError = validateRequiredDeclaration(state);
  if (declarationError) return declarationError;

  const undeclaredAssetError = validateDeclaredAssets(state);
  if (undeclaredAssetError) return undeclaredAssetError;

  const profileCollection = collectValidatedProfileIds(input, state);
  if (!profileCollection.ok) return profileCollection.decision;

  const uniqueValidatedProfileIds = toSortedUnique(profileCollection.validatedProfileIds);
  const missingRequiredProfileIds = state.requiredProfileIds.filter(
    (requiredId) => !uniqueValidatedProfileIds.includes(requiredId),
  );
  if (missingRequiredProfileIds.length > 0) {
    return deny(
      'MissingRequiredComplianceProfile',
      toAuditInput(state, uniqueValidatedProfileIds),
      missingRequiredProfileIds,
    );
  }

  return {
    allowed: true,
    audit: buildAudit(toAuditInput(state, uniqueValidatedProfileIds), []),
  };
}

function createComplianceEvaluationState(
  input: EvaluatePackEnablementComplianceInputV1,
): ComplianceEvaluationState {
  const declaredComplianceAssets = [...(input.manifest.assets.complianceProfiles ?? [])];
  return {
    packId: input.manifest.id,
    declaredComplianceAssets,
    declaredAssetSet: new Set(declaredComplianceAssets),
    parsedEntries: Object.entries(input.parsedProfilesByAsset),
    requiredProfileIds: toSortedUnique(input.requiredProfileIds),
  };
}

function validateRequiredDeclaration(
  state: ComplianceEvaluationState,
): PackEnablementComplianceDecisionV1 | null {
  if (state.requiredProfileIds.length === 0 || state.declaredComplianceAssets.length > 0) return null;
  return deny('MissingComplianceAssetDeclaration', toAuditInput(state, []));
}

function validateDeclaredAssets(
  state: ComplianceEvaluationState,
): PackEnablementComplianceDecisionV1 | null {
  for (const [assetPath] of state.parsedEntries) {
    if (!state.declaredAssetSet.has(assetPath)) {
      return deny('UndeclaredComplianceAsset', toAuditInput(state, []));
    }
  }
  return null;
}

function collectValidatedProfileIds(
  input: EvaluatePackEnablementComplianceInputV1,
  state: ComplianceEvaluationState,
): ProfileCollectionResult {
  const validatedProfileIds: string[] = [];
  for (const declaredAsset of state.declaredComplianceAssets) {
    const profile = input.parsedProfilesByAsset[declaredAsset];
    if (profile === undefined) {
      return {
        ok: false,
        decision: deny('MissingParsedComplianceProfile', toAuditInput(state, validatedProfileIds)),
      };
    }
    if (profile.packId !== state.packId) {
      return {
        ok: false,
        decision: deny('PackIdMismatch', toAuditInput(state, validatedProfileIds)),
      };
    }
    validatedProfileIds.push(String(profile.profileId));
  }
  return { ok: true, validatedProfileIds };
}

function toAuditInput(
  state: ComplianceEvaluationState,
  validatedProfileIds: readonly string[],
): ComplianceAuditInput {
  return {
    packId: state.packId,
    declaredComplianceAssets: state.declaredComplianceAssets,
    validatedProfileIds,
    requiredProfileIds: state.requiredProfileIds,
  };
}

function deny(
  reason: PackEnablementComplianceReasonV1,
  auditInput: ComplianceAuditInput,
  missingRequiredProfileIds: readonly string[] = [],
): PackEnablementComplianceDeniedV1 {
  return {
    allowed: false,
    reason,
    audit: buildAudit(auditInput, missingRequiredProfileIds),
  };
}

function buildAudit(
  auditInput: ComplianceAuditInput,
  missingRequiredProfileIds: readonly string[],
): PackEnablementComplianceAuditV1 {
  const { packId, declaredComplianceAssets, validatedProfileIds, requiredProfileIds } = auditInput;
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
