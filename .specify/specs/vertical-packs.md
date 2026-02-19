# Versioned Vertical Packs (Spec)

## Goal

Provide a governed extension mechanism where the Portarium core remains a horizontal control plane, and vertical/domain-specific behavior ships as **versioned, declarative packs**.

## Terms

- **Vertical Pack**: a versioned bundle of schemas/workflows/UI/mappings that extends the core through stable contracts.
- **Pack Manifest**: the required JSON document declaring identity, version, compatibility, dependencies, and assets.
- **Pack Lockfile**: the tenant-scoped record of enabled packs pinned to exact versions.

## Pack Manifest (v1)

File: `pack.manifest.json`

Required fields:

- `manifestVersion`: `1`
- `kind`: `VerticalPack` | `BasePack` | `ConnectorModule`
- `id`: lowercase dot-namespaced id (e.g. `scm.change-management`)
- `version`: SemVer (e.g. `1.2.3`)
- `requiresCore`: SemVer range (e.g. `>=0.1.0 <1.0.0`)
- `displayName`: human-readable name
- `assets`: object containing arrays of relative paths

Optional fields:

- `description`: string
- `dependencies`: object mapping `packId -> semver range`

Example:

```json
{
  "manifestVersion": 1,
  "kind": "VerticalPack",
  "id": "scm.change-management",
  "version": "1.2.3",
  "requiresCore": ">=0.1.0 <1.0.0",
  "displayName": "Software Change Management",
  "dependencies": {
    "base.approvals": ">=1.0.0 <2.0.0"
  },
  "assets": {
    "schemas": ["schema/*.json"],
    "workflows": ["workflows/*.json"],
    "uiTemplates": ["ui/*.json"],
    "mappings": ["mappings/*.json"],
    "testAssets": ["testdata/*.json"]
  }
}
```

## Compatibility Rules

- Packs use SemVer.
  - `major`: breaking change to pack contracts or persisted pack-owned data.
  - `minor`: additive backwards compatible change.
  - `patch`: bugfix/no contract impact.
- `requiresCore` must be satisfied by the running core version before a pack can be enabled.
- Dependencies must be satisfiable as a set; conflicts block resolution.

## Resolver Behavior (v1)

- Inputs: core version, requested packs (id + version range), and a registry.
- Output: a lockfile listing resolved packs pinned to exact versions.
- Strategy: greedy “pick highest compatible” per pack; fail fast on conflicts (no backtracking).
