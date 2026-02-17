# OpenFGA

- Provider ID: `openfga`
- Port Families: `IamDirectory`
- Upstream: `https://github.com/openfga/api`
- Pinned commit: `618e7e0a48786535e65c100f590a3d5b048c44c5` (vendored as a git submodule; run `npm run domain-atlas:vendor -- --only openfga` to ensure checkout)
- License: Apache 2.0 (`Apache-2.0`, `safe_to_reuse`)

## Scope (MVP)

- Treat OpenFGA as an **authorization (authz)** provider inside `IamDirectory`, focused on relationship-based permissions.
- Extract the API-facing domain surface (stores, tuples, authorization models, checks/expansions) as CIF entities + actions.

## Current Extraction (Initial)

- CIF: `domain-atlas/extracted/openfga/cif.json`
- Mapping: `domain-atlas/mappings/openfga/IamDirectory.mapping.json`
- Capability matrix: `domain-atlas/capabilities/openfga/IamDirectory.capability-matrix.json`
- Re-run: `npm run domain-atlas:extract:openfga`

Primary sources (protobuf API definitions):

- `domain-atlas/upstreams/openfga/openfga/v1/openfga_service.proto`
- `domain-atlas/upstreams/openfga/openfga/v1/openfga.proto`
- `domain-atlas/upstreams/openfga/openfga/v1/authzmodel.proto`

## Canonical Mapping Posture

- Avoid canonical bloat: most OpenFGA concepts map to `ExternalObjectRef` rather than introducing new canonical IAM objects.
- Tuples are treated as relationship facts (`object`, `relation`, `user`) and are evidence-relevant for approvals.

## Safety / Idempotency (Initial)

- Tuple writes are **not idempotent by default**; callers can opt into idempotent behavior via `on_duplicate: ignore` and `on_missing: ignore`.
- No generic idempotency key mechanism is assumed; adapters should use stable tuple keys and read-before-write where policy requires.
