# HashiCorp Vault

- Provider ID: `vault`
- Port Families: `SecretsVaulting`
- Upstream: `https://github.com/hashicorp/vault`
- Pinned commit: TBD (run `npm run domain-atlas:vendor -- --only vault`)

## What To Extract Next

- Core entities: mount (secret engines), policies, tokens, auth methods, identities, leases.
- Audit devices and evidence-relevant event surfaces.
- Namespace/multi-tenancy posture (if applicable) and isolation expectations.

## Mapping Notes (Canonical)

- Most objects likely remain `ExternalObjectRef`; canonical objects are minimal for this port family.

## Capability Matrix Notes

- Explicitly capture destructive actions and their safety tier defaults.
- Capture idempotency expectations (many operations are idempotent by path, not by key).

## Open Questions

- License classification and what parts are safe to reuse as dependencies (likely study-only).
