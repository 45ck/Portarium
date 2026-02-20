# Pack Compliance Enablement Policy (v1)

## Goal

Define enforcement behavior for enabling a vertical pack when workspace compliance requirements
exist.

## Inputs

- Pack manifest (`PackManifestV1`) with optional `assets.complianceProfiles`.
- Parsed compliance profile payloads keyed by asset path.
- Workspace-required compliance profile IDs.

## Enforcement Rules

1. If workspace-required profile IDs are non-empty, the manifest must declare at least one
   compliance profile asset.
2. Every declared compliance profile asset must be parsed and validated before enablement.
3. Parsed compliance profile assets must all be declared in the manifest.
4. Every parsed profile `packId` must match the manifest `id`.
5. All workspace-required profile IDs must be present in validated profile IDs.

## Decision Output

The policy evaluator returns:

- `allowed: true` with audit payload if all rules pass.
- `allowed: false` with reason and audit payload otherwise.

Denial reasons:

- `MissingComplianceAssetDeclaration`
- `MissingParsedComplianceProfile`
- `UndeclaredComplianceAsset`
- `PackIdMismatch`
- `MissingRequiredComplianceProfile`

## Audit Payload Requirements

Every decision includes:

- `packId`
- `declaredComplianceAssets`
- `validatedProfileIds`
- `requiredProfileIds`
- `missingRequiredProfileIds`
