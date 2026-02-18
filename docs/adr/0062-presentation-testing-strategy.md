# ADR-0062: Presentation Testing Strategy

**Beads:** bead-0359 (unit/component tests), bead-0360 (E2E smoke tests), bead-0361 (visual acceptance), bead-0364 (Storybook), bead-0369 (Chromatic), bead-0374 (CI gate)
**Status:** Accepted
**Date:** 2026-02-18

## Context

The cockpit presentation layer has three test concerns:

1. **Unit/component**: domain primitive components render correctly for all state variants
2. **E2E smoke**: critical user flows complete end-to-end (approval, run cancel, evidence export)
3. **Visual regression**: trust-UI components (effects, evidence, approval form) don't visually regress

## Decisions

### Unit / Component Tests (bead-0359)

Vitest + React Testing Library. Test matrix per component:

| Component                | States tested                                                    |
| ------------------------ | ---------------------------------------------------------------- |
| `RunStatusChip`          | pending, running, waiting-approval, succeeded, failed, cancelled |
| `EffectsList`            | planned, predicted, verified; confidence variants; idem-badge    |
| `EvidenceTimeline`       | normal, hash-mismatch (tamper), WORM-locked                      |
| `ApprovalDecisionForm`   | eligible, SoD-blocked, N-of-M pending                            |
| `ErrorBanner` (RFC 9457) | all Problem Type variants; copyable instance-id                  |

Coverage target: **80%** lines for `src/presentation/ops-cockpit/components/`.

### E2E Smoke Tests (bead-0360)

Playwright. Three critical flows tested against a test-double API server:

1. **Approval flow**: Login → inbox → open WI-1099 → run detail → ApprovalDecisionForm → submit with rationale → verify run transitions to Executing
2. **Run cancel**: Run detail → Cancel → confirm dialog → verify run transitions to Cancelled → retry button appears
3. **Evidence fallback**: Disconnect realtime → staleness indicator appears within 35 s → reconnect → staleness clears

### Visual Acceptance Tests (bead-0361, bead-0369)

Storybook + Chromatic CI:

- Stories for all domain primitive components in all state variants
- Chromatic snapshot on every PR; diff threshold 0.1%
- `--exit-zero-on-changes` for draft PRs; `--auto-accept-changes` on main after review

### CI Gate (bead-0374)

PR gate (`npm run ci:pr`) requires in order:

1. `lint` + `typecheck`
2. `test:unit` (Vitest, coverage ≥ 80%)
3. `test:component` (Vitest + RTL)
4. `build` (Vite production bundle)
5. `test:e2e:smoke` (Playwright, 3 flows)
6. `chromatic` (visual regression)

Nightly gate additionally runs: 7. `npm audit --audit-level=high` 8. `test:e2e:full` (all E2E flows)

## Storybook Setup (bead-0364)

`@storybook/react-vite` with addons:

- `@storybook/addon-a11y` — axe-core violations shown inline
- `@storybook/addon-interactions` — step-by-step interaction testing
- `@chromatic-com/storybook` — snapshot upload

Stories located at `src/presentation/ops-cockpit/components/**/*.stories.tsx`.

## Consequences

- All domain primitives have living documentation via Storybook
- Visual regressions caught before merge
- Three E2E smoke tests provide high-confidence end-to-end coverage with manageable maintenance burden
- CI gate enforces quality before any merge to main
