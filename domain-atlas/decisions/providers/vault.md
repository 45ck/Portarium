# HashiCorp Vault

- Provider ID: `vault`
- Port Families: `SecretsVaulting`
- Upstream: `https://github.com/hashicorp/vault`
- Pinned commit: `bc33fac9b157fcb7c45b0b68ca2539b6be82f612`
- License: Business Source License 1.1 (`BUSL-1.1`, `unsafe_dependency`)

## What To Extract Next

- Core entities: mount (secret engines), policies, tokens, auth methods, identities, leases.
- Audit devices and evidence-relevant event surfaces.
- Namespace/multi-tenancy posture (if applicable) and isolation expectations.

## Current Extraction (Initial)

- CIF: `domain-atlas/extracted/vault/cif.json`
- Mapping: `domain-atlas/mappings/vault/SecretsVaulting.mapping.json`
- Capability matrix: `domain-atlas/capabilities/vault/SecretsVaulting.capability-matrix.json`
- Re-run: `npm run domain-atlas:extract:vault`

Entities extracted from Go API types under `domain-atlas/upstreams/vault/api/`:

- `Secret`, `SecretAuth`, `SecretWrapInfo`, MFA helper types
- `TokenCreateRequest`
- `MountInput`, `MountConfigInput`, `MountOutput`, `MountConfigOutput`
- `EnableAuditOptions`, `Audit`
- `KVMetadata*`, `KVVersionMetadata`

## Mapping Notes (Canonical)

- Most objects likely remain `ExternalObjectRef`; canonical objects are minimal for this port family.

## Capability Matrix Notes

- Explicitly capture destructive actions and their safety tier defaults.
- Capture idempotency expectations (many operations are idempotent by path, not by key).

## Open Questions

- How to model namespaces/multi-tenancy in a provider-agnostic way for adapters.
- What evidence should be stored for secret writes (metadata-only by default, with explicit policies for value capture).
