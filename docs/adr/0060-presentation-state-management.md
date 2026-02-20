# ADR-0060: Presentation State Management

**Bead:** bead-0363
**Status:** Accepted
**Date:** 2026-02-18

## Context

The cockpit has two categories of state:

1. **Server state** — runs, approvals, evidence, adapters (lives on the API; needs caching, invalidation, background refresh)
2. **UI state** — selected persona, open drawers, command palette visibility, optimistic mutations (lives in the browser)

Mixing these in a single store causes stale-data bugs and unnecessary complexity.

## Decision

**TanStack Query v5** for server state:

- All API calls via `useQuery` / `useMutation` hooks
- Cache keyed by `[resource, workspaceId, ...params]`
- Background refetch interval: 30 s (degraded) / EventSource invalidation (healthy)
- Optimistic updates via `useMutation` `onMutate` + rollback on error
- Problem Details errors surfaced as `MutationError` and rendered by `ErrorBanner`

**Zustand** (single store) for UI state:

- `persona: Persona`, `activeScreen: ScreenId`
- `openDrawers: Set<DrawerId>`, `commandPaletteOpen: boolean`
- `realtimeMode: 'live' | 'degraded' | 'offline'`
- No derived server state stored here — read from TanStack Query cache

## Consequences

- Clear separation: TanStack Query owns all data freshness; Zustand owns UI concerns only
- Devtools available for both (TanStack Query Devtools, Zustand devtools middleware)
- No Redux boilerplate; no Context value re-render cascades for server state
- Migration path: if needs grow, Zustand slices can be extracted without breaking TanStack Query layer

## Implementation Mapping

- Closed implementation coverage:
  - `bead-0363`
- ADR linkage verification review bead:
  - `bead-0616`

## Review Linkage

- `docs/review/bead-0616-adr-0060-linkage-review.md`
