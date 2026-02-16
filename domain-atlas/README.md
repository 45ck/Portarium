# Domain Atlas

The Domain Atlas is Portarium's re-runnable research pipeline for extracting and synthesising domain models from Systems of Record (SoRs) into VAOP-ready artefacts.

It exists to make adapter development deterministic and governable:

- **CIF snapshots**: machine-readable domain extracts anchored to upstream commits/versions.
- **Mappings**: explicit translation tables from vendor entities to VAOP canonical objects.
- **Capability matrices**: action-first metadata describing what an adapter can safely do.
- **Contract fixtures**: record/replay data to test adapters without live SaaS flakiness.
- **License intake**: classification to prevent licence contamination in critical paths.

This is an internal control-plane toolchain, not a product surface. See `docs/adr/0035-domain-atlas-research-pipeline.md`.

## Structure

```
domain-atlas/
  schema/         # JSON Schemas for artefacts (validated in CI)
  sources/        # Source intake manifests (upstream repo/spec + licence + extraction notes)
  upstreams/      # Local upstream clones (gitignored; used for extraction)
  extracted/      # CIF snapshots (neutral intermediate format)
  mappings/       # CIF -> canonical mappings (explicit, versioned)
  capabilities/   # Capability Matrix instances per provider/port family
  decisions/      # Small ADR-like notes for field/invariant choices (optional)
```

## Workflow (repeatable per upstream system)

1. **Intake**: create `sources/<provider>/source.json` with upstream location, commit/version, and licence classification.
2. **Extract**: generate `extracted/<provider>/cif.json` (CIF) by reading the "honest schema" sources (migrations, ORM entities, OpenAPI, GraphQL schema, etc.).
3. **Map**: add `mappings/<provider>/mapping.json` mapping vendor entities/fields to canonical objects (anti-corruption layer posture).
4. **Declare**: add `capabilities/<provider>/<PortFamily>.capability-matrix.json` describing supported actions, safety properties, limits, and idempotency mechanisms.
5. **Verify locally**: add contract fixtures and tests (record/replay) so CI can validate adapter conformance without live calls.

## Vendoring upstream repos (local-only)

To clone upstream repos referenced in `sources/*/source.json` into `domain-atlas/upstreams/` and pin missing commits in the source manifests:

- `npm run domain-atlas:vendor`

## Validation

Artefacts are validated in CI by `src/infrastructure/domain-atlas/domain-atlas-artifacts.test.ts`, which:

- compiles JSON Schemas under `domain-atlas/schema/`
- validates example artefacts under `domain-atlas/**` against those schemas
