# ADR-0059: Presentation Rendering Strategy

**Beads:** bead-0354 (lazy loading), bead-0370 (rendering strategy)
**Status:** Accepted
**Date:** 2026-02-18

## Context

The ops-cockpit is an internal operator tool (not public-facing). Requirements:

- Fast shell load (approver may act under time pressure)
- Heavy views (workflow builder ~150KB JS, evidence explorer ~80KB) must not penalise shell boot
- No SEO requirement
- Auth-gated (no unauthenticated landing page)

Options: Full SSR (Next.js), CSR SPA, hybrid (Astro/Remix), static shell + dynamic islands.

## Decision

**CSR SPA** (React 19, Vite) with **route-level lazy loading** via `React.lazy` + `Suspense`.

- App shell (nav, statusbar, inbox) loads synchronously — target < 50 KB gzip
- Heavy views code-split by route:
  - `workflow-builder` → dynamic import on `/builder/*`
  - `evidence-explorer` → dynamic import on `/evidence/*`
  - `adapters-gallery` → dynamic import on `/adapters`
  - `governance` → dynamic import on `/governance`
- Skeleton screens shown during Suspense boundaries (bead-0479 patterns)
- SSR not adopted unless TTFB SLO fails or auth complexity requires server session hydration

## Consequences

- Shell bundle stays small; heavy views only downloaded when needed
- Suspense boundaries provide UX feedback with skeleton screens
- Static deployment (S3 + CloudFront) — no server runtime required
- If SSR is needed later, migration to Remix is the natural path (ADR to supersede this)

## Implementation Mapping

- Closed implementation coverage:
  - `bead-0354`
  - `bead-0370`
- ADR linkage verification review bead:
  - `bead-0615`

## Review Linkage

- `docs/review/bead-0615-adr-0059-linkage-review.md`
