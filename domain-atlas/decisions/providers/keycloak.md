# Keycloak

- Provider ID: `keycloak`
- Port Families: `IamDirectory`
- Upstream: `https://github.com/keycloak/keycloak`
- Pinned commit: `8258fceb33ef10840021cf4f472e8dac035ebe62`

## What To Extract Next

- Core entities: Realm, User, Group, Role (realm/client), Client (application), IdentityProvider, Session.
- Lifecycle/state: enabled/disabled users, group membership, credential reset flows.
- Event/audit concepts (admin events, auth events) relevant to Evidence Log semantics.

## Mapping Notes (Canonical)

- Users map to `Party` with role tags (`user`, `employee`) depending on tenant posture.
- Many IAM configuration objects (flows, policies) likely remain `ExternalObjectRef`.

## Capability Matrix Notes

- Identify safe idempotent operations vs non-idempotent (credential resets, destructive deletes).
- Explicitly capture rate limits (if any) and pagination semantics in capabilities.

## Open Questions

- Best source of truth for extraction: Admin REST/OpenAPI vs deriving from server model?
