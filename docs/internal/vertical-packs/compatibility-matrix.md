# Vertical Pack Compatibility Matrix

This document defines the lifecycle compatibility policy enforced by pack manifest parsing and
pack resolution.

## Core Support Policy

- Core compatibility remains SemVer range based via `requiresCore`.
- Core supports one current minor and one previous minor within the same major (`N` and `N-1`).

## Pack Lifecycle Catalogue

Supported lifecycle statuses:

- `experimental`
- `beta`
- `stable`
- `LTS`
- `deprecated`
- `end-of-life`

Status intent:

- `experimental`: early validation, no production default enablement guarantees.
- `beta`: pre-stable hardening, compatible but still change-prone.
- `stable`: default production train.
- `LTS`: long-term support train for slower enterprise upgrade cadence.
- `deprecated`: still usable for existing tenants during deprecation window.
- `end-of-life`: no new-tenant enablement and no active support guarantees.

## Support Window Policy

Each manifest must declare `lifecycle.supportWindows[]` entries with:

- `train`: `Current` or `LTS`
- `startsAt`: ISO timestamp
- `endsAt`: ISO timestamp (`endsAt >= startsAt`)

Minimum window durations:

- `Current`: 180 days minimum
- `LTS`: 365 days minimum

Status-to-train requirements:

- `experimental`, `beta`, `stable`, `deprecated` require a `Current` support window.
- `LTS` requires an `LTS` support window.

## Resolver Gate Matrix

| Condition                                                       | Existing Tenant                                           | New Tenant (Default) | Notes                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| `stable` / `beta` / `experimental` with active `Current` window | allowed                                                   | allowed              | must have active `Current` window at resolution time             |
| `LTS` with active `LTS` window                                  | allowed                                                   | allowed              | must have active `LTS` window at resolution time                 |
| `deprecated` with active `Current` window                       | allowed                                                   | blocked              | new-tenant block can be explicitly overridden in resolver policy |
| `end-of-life`                                                   | allowed only when explicitly requested and policy permits | blocked              | new-tenant block is deny-by-default                              |
| required support window inactive (expired or not started)       | blocked                                                   | blocked              | resolver rejects candidate version                               |

## Operational Guidance

- Prefer `stable` for normal production tenants.
- Prefer `LTS` only for tenants with explicit long-term support requirements.
- Treat `deprecated` as migration-only state and schedule upgrade off it.
- Do not onboard new tenants to `deprecated` or `end-of-life` versions without explicit override
  and documented risk acceptance.
