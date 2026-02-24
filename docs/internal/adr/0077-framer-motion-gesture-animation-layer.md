# ADR-0077: Framer Motion for Gesture & Animation Layer

**Status:** Accepted
**Date:** 2026-02-21
**Deciders:** UI team

## Context

The approvals triage card uses Tinder-style swipe gestures to approve/deny items.
The existing implementation (`use-swipe-gesture.ts`) manually tracks pointer events
and applies CSS transforms, which produces workable but limited results:

- No velocity sampling — a fast flick and a slow drag past the threshold behave identically.
- Spring snap-back is emulated with `cubic-bezier` transitions, not true spring physics.
- CSS `@keyframes` exit animations can't adapt to the card's current position/velocity.
- Ghost-card "peek" effects require re-renders on every pointer move.

## Decision

Adopt **framer-motion** (v11) as the gesture and animation engine for the triage UI:

- `motion.div` with `drag="x"` replaces the hand-rolled Pointer Events API.
- `useMotionValue` + `useTransform` drive ghost-card scale, tint overlays, and
  decision stamps at 60 fps without React re-renders.
- `useAnimationControls` orchestrates velocity-aware exit animations.
- `AnimatePresence` handles mode-switch crossfades and card entrance/exit.
- `useReducedMotion()` provides native `prefers-reduced-motion` support.

## Consequences

- **Bundle impact:** ~33 kB gzipped (tree-shaken). Acceptable for a data-dense
  cockpit that already ships Leaflet, Recharts, and React Flow.
- **Existing CSS animations** for mode sub-components (`animate-replay-step`,
  `animate-signal-fade-in`, `animate-graph-node-in`, `animate-queue-clear-ring`)
  remain as-is — framer-motion is scoped to the triage deck and card transitions.
- `use-swipe-gesture.ts` has been removed after deck stabilization.
