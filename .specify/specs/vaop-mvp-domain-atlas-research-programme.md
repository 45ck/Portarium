# Portarium MVP: Domain Atlas Research Programme

## Objective

Portarium's MVP problem is operating external Systems of Record (SoRs) safely, not rebuilding those SoRs. The Domain Atlas exists to extract **domain semantics + safe action surfaces** so Portarium can enforce policy, approvals, credential handling, RBAC, and evidence capture consistently across many providers.

## Deliverables (MVP)

The research programme produces artefacts that become Portarium primitives:

- **Source manifests**: upstream location + pinned commit/version + licence classification.
- **CIF snapshots**: neutral domain extracts (entities/fields/relationships/lifecycles/actions/events/extension points).
- **Mappings**: explicit CIF -> canonical mappings (anti-corruption layer posture).
- **Capability matrices**: action-first metadata (limits, idempotency, diff/plan support, safety tier defaults).
- **Contract fixtures/tests**: record/replay data enabling deterministic local verification.

## Repo Requirements

1. A `domain-atlas/` tree exists with subfolders: `schema/`, `sources/`, `extracted/`, `mappings/`, `capabilities/`, `decisions/`.
2. JSON Schemas exist under `domain-atlas/schema/`:
   - `source-manifest.schema.json`
   - `cif.schema.json`
   - `mapping.schema.json`
   - `capability-matrix.schema.json`
3. At least one provider example exists and validates against schemas (e.g., `stripe`).
4. CI validates domain-atlas artefacts against schemas (no manual spot-checking).

## Non-Goals (MVP)

- Fully automated extraction for every upstream technology (ORMs, migrations, DocTypes, etc.).
- Guaranteeing lossless vendor schema representation in canonical objects (canonical is intersection-only).
- Using strong-copyleft or fair-code code as critical-path dependencies (study is allowed; reuse is not).

## Further Reading

- `docs/research/vaop-mvp-domain-atlas-research-programme.md`
