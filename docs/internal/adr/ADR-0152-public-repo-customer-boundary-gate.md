# ADR-0152: Public Repo Customer Boundary Gate

**Status:** Proposed
**Date:** 2026-05-08

## Context

Portarium is an open source platform. Private deployments may add customer
extensions, data bridges, fixtures, routes, and operator packaging, but those
assets must not leak back into the public platform repository.

The Cockpit extension host now supports customer-owned route modules,
host-provided read models, and host-native surfaces. That is the right split:
Portarium owns generic platform contracts and reusable host rendering, while
private repos own customer identity, source-system details, and packaged
extensions.

## Decision

Add a repository-level customer boundary check to Portarium and run it from
`npm run ci:gates`.

The check scans tracked text files for private customer names, package scopes,
acronyms, and extension slugs that are known to belong outside the public
repository. When it finds a match, it fails with guidance to keep those assets
in private extension repositories.

## Consequences

Positive:

- Portarium can keep evolving generic extension primitives without committing
  private customer identity or deployment-specific content.
- Customer packages can still use the public extension host through typed
  manifests, route loaders, and native surface descriptors.
- Gate failures catch accidental leakage before public commits are merged.

Negative:

- The deny list must be maintained when new private customer repos are used as
  proving grounds.
- Rare false positives may require either wording changes or a narrow,
  reviewed allowlist entry.

## Implementation Notes

The initial implementation is `scripts/repo/check-customer-boundary.mjs`.
It uses `git ls-files` so it scans committed source, docs, configs, and tests
instead of transient local artifacts.

The gate baseline is regenerated because `package.json` is a critical gate file
under ADR-0041.
