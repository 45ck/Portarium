# Engineering Review: Portarium Cockpit UI

**Reviewer:** Senior Web Engineer (automated review)
**Date:** 2026-02-20
**Scope:** All `.tsx` / `.ts` source files under `apps/cockpit/src/`, plus `package.json`, `tsconfig.app.json`, and `vite.config.ts`.

---

## Executive Summary

The cockpit codebase is well-structured for its stage of development. It uses a clean layered import pattern (hooks → components → routes), adopts Radix UI / shadcn primitives consistently, and enforces strict TypeScript. The most pressing concerns are: **no error boundaries anywhere**, **hardcoded mock data embedded in production components**, a **missing dependency array in a `useEffect`** causing a stale-closure keyboard shortcut bug, **array index keys** in multiple lists, and **no loading/error states for the observability route**. There are no `dangerouslySetInnerHTML` usages and no XSS vectors found.

---

## 1. Accessibility

### 1.1 — [Major] No skip-to-content link

**File:** `src/routes/__root.tsx`

The root layout renders a persistent sidebar followed by a `<main>` element, but there is no skip link allowing keyboard-only or screen-reader users to jump past navigation.

**Fix:** Add `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to content</a>` as the first child of `<body>` or the root `<div>`, and add `id="main-content"` to the `<main>` element.

---

### 1.2 — [Major] Sidebar has no `aria-label` on `<nav>`; collapsed state not communicated to screen readers

**File:** `src/routes/__root.tsx`, lines 192–213

The `<nav>` element carries no `aria-label`. Additionally, when `sidebarCollapsed` is true, icon-only navigation links are rendered with no visible text, but no `aria-label` or `title` is added to the `<NavLink>` itself — only its children change. Screen readers will announce the route path instead.

**Fix:**

```tsx
<nav aria-label="Primary navigation" ...>
```

When collapsed, add `aria-label={item.label}` to the `<NavLink>` (or pass it through to the underlying `<TypedLink>`).

---

### 1.3 — [Major] NavSection uses `<a>` instead of TanStack Router `<Link>` — full page reload on navigation

**File:** `src/components/cockpit/nav-section.tsx`, line 22

`NavSection` renders a plain `<a href={item.to}>` anchor. This causes a full page reload on every click, destroying React Query cache. The component is not actually used in the root layout (which uses `NavLink`/`TypedLink`), but if used elsewhere it would be broken. It also means keyboard focus resets to `<body>` on each navigation.

**Fix:** Replace `<a>` with the TanStack `<Link>` component and use the `activeProps` API for active-state styling.

---

### 1.4 — [Minor] `WorkforceMemberCard` — clickable `<Card>` has no keyboard role or focusability

**File:** `src/components/cockpit/workforce-member-card.tsx`, line 24

When `onClick` is provided, the card is visually clickable (cursor-pointer) but is a `<div>`, making it inaccessible via keyboard (Tab does not focus it; Enter/Space do nothing).

**Fix:** Either wrap in a `<button>` or add `role="button" tabIndex={0} onKeyDown={handleKeyDown}`.

---

### 1.5 — [Minor] `ThemePicker` — active theme not communicated to screen readers

**File:** `src/components/cockpit/theme-picker.tsx`, line 41

The selected theme button has a visual ring but no `aria-pressed` or `aria-current` attribute.

**Fix:** Add `aria-pressed={isActive}` to each theme button.

---

### 1.6 — [Minor] Filter buttons in `robots.tsx` missing `aria-pressed`

**File:** `src/routes/robotics/robots.tsx`, lines 183–189

The class filter buttons show a visual active state but do not set `aria-pressed`.

**Fix:** Add `aria-pressed={classFilter === f.value}` to each filter button.

---

### 1.7 — [Minor] Icon-only badges carry no accessible label

**Files:** `src/components/cockpit/run-status-badge.tsx`, `src/components/cockpit/agent-capability-badge.tsx`, `src/components/cockpit/execution-tier-badge.tsx`

The Lucide icons inside badges use no `aria-hidden` attribute, so screen readers announce the SVG title. Add `aria-hidden="true"` to the icon, and rely on the visible text label (which is already present).

**Fix:**

```tsx
<Icon className="h-3 w-3" aria-hidden="true" />
```

---

### 1.8 — [Minor] `SectionHeader` icon is not `aria-hidden`

**File:** `src/routes/inbox.tsx`, line 29

The icon passed into `<SectionHeader>` is decorative (the label is immediately adjacent), but it is not marked `aria-hidden="true"`.

---

### 1.9 — [Minor] Colour contrast relies on semantic tokens — unverified

**Files:** throughout

Severity classes like `'text-red-600'`, `'text-yellow-600'`, `'text-green-600'` are applied directly without checking contrast against their background. On the `theme-warm` (amber background) and `theme-quantum` (purple background) themes, yellow/green text may fail WCAG AA 4.5:1 for small text. A contrast audit with each theme is recommended.

---

### 1.10 — [Minor] `EvidenceTimeline` — timeline connector line is purely visual with no text alternative

**File:** `src/components/cockpit/evidence-timeline.tsx`, lines 52–54

The connecting vertical line `<div className="w-px flex-1 bg-border mt-1" />` is fine as-is (pure presentation), but the dot colours convey semantic meaning (category) with no alternative for users who cannot distinguish colour. The `EvidenceCategoryBadge` shown alongside provides a text label, so this is borderline — but it should be confirmed that the badge is always visible.

---

## 2. React Best Practices

### 2.1 — [Critical] `useEffect` in `ApprovalTriageCard` has no dependency array

**File:** `src/components/cockpit/approval-triage-card.tsx`, line 485

```ts
useEffect(() => {
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}); // ← no dependency array
```

Without a dependency array the effect runs **after every render**, attaching a new event listener and immediately removing the old one every render cycle. This means `onKey` always closes over the latest render's values, but causes unnecessary DOM operations on every render. More importantly, the `handleAction` function referenced inside `onKey` is recreated on every render and itself references `rationale`, `isBlocked`, `loading`, and `requestChangesMode` — all via closure. While currently functional, this is a fragile stale-closure pattern that is one refactor away from breaking.

**Fix:** Add a stable dependency array. Since `handleAction` is defined inline it must be wrapped in `useCallback`, or the key handler must be extracted:

```ts
useEffect(() => {
  function onKey(e: KeyboardEvent) { ... }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [isBlocked, loading, rationale, requestChangesMode, handleAction])
```

---

### 2.2 — [Major] Array-index keys used in multiple lists

**Files:**

- `src/routes/explore/objects.tsx`, line 76: `key={\`${ref.externalId}-${i}\`}` — composite but still uses index
- `src/routes/robotics/safety.tsx`, line 123: `key={idx}` on audit log rows
- `src/components/cockpit/approval-triage-card.tsx`, line 388: `key={i}` on history entries
- `src/components/cockpit/page-header.tsx`, line 27: `key={i}` on breadcrumb items
- `src/components/cockpit/approval-triage-card.tsx`, line 495: `key={i}` on progress dots

Index keys cause reconciliation bugs when items are reordered or removed. They also suppress React's warning system that catches incorrect key usage.

**Fix:** Use stable, unique identifiers (e.g., `entry.timestamp + entry.actor` for history, `constraintId` for audit log, `item.label` for breadcrumbs).

---

### 2.3 — [Major] Hardcoded mock data in production components

**Files:**

- `src/routes/inbox.tsx`, lines 105–118: `MOCK_VIOLATIONS` constant with hardcoded policy violation data
- `src/components/cockpit/approval-triage-card.tsx`, lines 36–101: `getSodEvaluation()`, `getPolicyRule()`, and `getHistory()` are hardcoded look-ups keyed on specific approval IDs (`apr-3002`, `apr-3004`)
- `src/routes/explore/governance.tsx`, lines 40–52: `SOD_CONSTRAINTS` and `POLICIES` are static constants
- `src/routes/explore/governance.tsx`, lines 69–73: `KpiRow` stats contain hardcoded numbers (`3`, `12`, `4`)

This couples the UI tightly to demo data and makes it impossible to see real policy data in production without a code change.

**Fix:** Either move mocks behind an MSW handler (already used for other routes), or replace with API calls guarded by a feature flag. At minimum, add a `// TODO: remove mock` comment with a tracking issue.

---

### 2.4 — [Major] `ExploreEventsPage` duplicates the `useEvidence` query inline

**File:** `src/routes/explore/events.tsx`, lines 13–21

The page calls `useQuery` directly with the `/v1/workspaces/${wsId}/evidence` URL and a 5-second `refetchInterval`, rather than using the existing `useEvidence` hook from `src/hooks/queries/use-evidence.ts`. This means two slightly-different code paths manage the same query key `['evidence', wsId]`, but one does not have `refetchInterval` and the other does. React Query will merge them into a single network request, but the diverged configuration is confusing.

**Fix:** Extend `useEvidence` to accept an optional `refetchInterval` parameter, or create `useEvidenceLive` — then use that in `ExploreEventsPage`.

---

### 2.5 — [Minor] `KpiRow` uses inline `style` with dynamic `gridTemplateColumns`

**File:** `src/components/cockpit/kpi-row.tsx`, line 18

```tsx
<div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
```

This creates a new object on every render, though in practice the parent rarely changes `stats.length`. It also limits responsiveness — on narrow viewports (mobile) all KPI cards are forced into a single row regardless of width.

**Fix:** Derive the column count via a responsive Tailwind class or provide `sm:`/`lg:` breakpoints:

```tsx
// e.g. for 2–4 items, always wrapping on mobile
<div className="grid gap-3 grid-cols-2 md:grid-cols-4">
```

---

### 2.6 — [Minor] `initials()` function is duplicated

**Files:**

- `src/routes/workforce/$memberId.tsx`, lines 20–26
- `src/components/cockpit/workforce-member-card.tsx`, lines 18–19

Identical implementation. Extract to a shared utility.

---

### 2.7 — [Minor] `RobotDetailSheet` — `useState(false)` for `showConfirm` defined inside the sheet

**File:** `src/routes/robotics/robots.tsx`, line 83

The `showConfirm` state inside `RobotDetailSheet` is not reset when `robot` changes (i.e., when the user closes the sheet for robot A and opens it for robot B). If the sheet briefly re-opens with the previous `robot` prop before `onClose` clears `selectedRobot`, the confirm state leaks.

**Fix:** Reset confirm state in a `useEffect` keyed on `robot?.robotId`, or lift the confirm state to the parent and reset it in `onClose`.

---

## 3. TypeScript

### 3.1 — [Major] Unsafe `as string` cast on route paths suppresses type-checking

**File:** `src/routes/inbox.tsx`, lines 198, 211

```tsx
navigate({ to: '/approvals/$approvalId' as string, params: { approvalId: a.approvalId } });
navigate({ to: '/approvals' as string });
```

Casting `to` to `string` disables TanStack Router's type-safe navigation, meaning typos in route paths will only fail at runtime, not at compile time.

**Fix:** Register all route paths in the router tree first (the root comment in `__root.tsx` acknowledges this is pending). Once registered, remove the `as string` casts.

---

### 3.2 — [Major] `(row as Record<string, unknown>)[col.key]` — unsafe property access

**File:** `src/components/cockpit/data-table.tsx`, line 141

```tsx
String((row as Record<string, unknown>)[col.key] ?? '');
```

This cast bypasses TypeScript's generic `T` constraint. If `col.key` doesn't exist on `T`, this silently returns `''`. This would be caught by proper typing.

**Fix:** Accept a typed accessor in the Column interface:

```ts
interface Column<T> {
  key: keyof T & string
  render?: (row: T) => React.ReactNode
  ...
}
```

Then access as `String(row[col.key as keyof T] ?? '')`.

---

### 3.3 — [Minor] `r.json()` without explicit return type loses type safety in two places

**Files:**

- `src/routes/explore/events.tsx`, line 18: `return r.json() as Promise<{ items: EvidenceEntry[] }>`
- `src/routes/explore/observability.tsx`, line 42: `return r.json()` (no cast at all — returns `Promise<any>`)

The observability route's `queryFn` returns `r.json()` untyped. While `useQuery<ObservabilityData>` at line 35 constrains the result, an invalid API response will silently type-coerce.

**Fix:** Add explicit return type annotations to all `queryFn` functions, consistent with the hook pattern used in `src/hooks/queries/*.ts`.

---

### 3.4 — [Minor] `approval.dueAtIso!` non-null assertion without guard

**File:** `src/components/cockpit/approval-triage-card.tsx`, line 541

```tsx
Due {format(new Date(approval.dueAtIso!), 'MMM d, HH:mm')}
```

This assertion is used inside an `{isOverdue && ...}` block where `isOverdue` is:

```ts
const isOverdue = Boolean(approval.dueAtIso && new Date(approval.dueAtIso) < new Date());
```

So `dueAtIso` is guaranteed non-null at this point. The assertion is semantically safe but fragile — if the guard changes, it becomes a runtime error. Prefer optional chaining: `approval.dueAtIso ? format(...) : ''`.

---

### 3.5 — [Minor] `config[mode] ?? config['log']` — `config['log']` will never be undefined

**File:** `src/routes/robotics/safety.tsx`, line 22

```ts
const c = config[mode] ?? config['log'];
```

`config` is `Record<EnforcementMode, ...>` and `mode` is typed as `EnforcementMode`, so `config[mode]` can never be `undefined`. The fallback is dead code that misleads readers into thinking `mode` can be out-of-range.

---

### 3.6 — [Minor] Missing `React` import for `React.ReactNode` / `React.ElementType` in JSDoc-style type positions

**Files:** `src/components/cockpit/system-state-banner.tsx` line 13, `src/components/cockpit/chain-integrity-banner.tsx` line 9, `src/components/cockpit/step-list.tsx` line 17

The files reference `React.ElementType` and `React.ReactNode` in types without importing React. This works with `react-jsx` transform (no JSX import needed) and `skipLibCheck`, but it relies on the global JSX namespace. A more explicit approach is to import the types: `import type { ElementType, ReactNode } from 'react'`.

---

## 4. Performance

### 4.1 — [Major] Recharts `<ResponsiveContainer>` is imported from the full `recharts` bundle

**File:** `src/routes/explore/observability.tsx`, lines 1–13

`recharts` is a heavy library (~300 KB gzipped). The observability chart is a secondary route that most users may never visit. Importing it at the top of the file pulls it into the main chunk.

**Fix:** Lazy-load the chart using React's `lazy` + `Suspense`:

```tsx
const ObservabilityChart = lazy(() => import('./ObservabilityChart'));
```

Or dynamic-import the entire observability route using TanStack Router's lazy route pattern.

---

### 4.2 — [Minor] Inline objects in JSX props create new references on every render

**Files:**

- `src/routes/robotics/robots.tsx`, line 168: inline array literal `[{label, value}, ...]` passed as `stats` prop to `KpiRow` re-creates on every render of `RobotsPage`
- `src/routes/inbox.tsx`, lines 169–174: same pattern with `stats` array to `KpiRow`

Since `KpiRow` is a pure presentational component receiving simple primitives, this is only a minor concern — React's reconciler diffing is fast here. However, if `KpiRow` were ever wrapped in `React.memo`, these inline arrays would prevent memoization from working.

**Fix:** Derive the stats array outside JSX or with `useMemo` when its inputs change:

```tsx
const kpiStats = useMemo(() => [...], [isLoading, stats.total, ...])
```

---

### 4.3 — [Minor] `useTheme` called in `RootLayout` but return value is discarded

**File:** `src/routes/__root.tsx`, line 169

```tsx
useTheme(); // called for side-effect (applying class to <html>)
```

The hook is called purely for its `useEffect` side effect. While functional, it's non-obvious. Consider documenting this with a comment, or placing the side effect in a dedicated `ThemeInitializer` component.

---

## 5. Responsiveness

### 5.1 — [Major] Fixed sidebar width breaks at small viewports

**File:** `src/routes/__root.tsx`, lines 177–220

The layout uses `flex h-screen` with a sidebar of `w-64` (or `w-16` collapsed). On viewports narrower than ~500 px (e.g., mobile), the sidebar + main area do not stack — the main content area is severely compressed. There is no mobile nav drawer or hamburger menu.

**Fix:** At `sm:` breakpoint and below, hide the sidebar and replace with a bottom tab bar or a hamburger menu that opens a drawer (the `vaul` package is already in `dependencies`).

---

### 5.2 — [Major] KPI grid breaks at narrow widths

**File:** `src/components/cockpit/kpi-row.tsx`, line 18

As noted in section 2.5, `repeat(${stats.length}, minmax(0, 1fr))` forces all KPI cards into one row regardless of viewport width. On mobile, 4-column rows become unreadable tiny cards.

---

### 5.3 — [Minor] `DataTable` has no horizontal scroll wrapper

**File:** `src/components/cockpit/data-table.tsx`

Wide tables (e.g., safety constraints with 5 columns) will overflow their container on narrow screens rather than scrolling horizontally.

**Fix:** Wrap `<Table>` in `<div className="overflow-x-auto">`.

---

### 5.4 — [Minor] `robots.tsx` — `grid-cols-4` KPI row

**File:** `src/routes/robotics/robots.tsx`, line 167

```tsx
<div className="grid grid-cols-4 gap-3">
```

Hard-coded 4-column grid has no responsive variant. On mobile this renders 4 very narrow cards.

**Fix:** Use `grid-cols-2 sm:grid-cols-4`.

---

## 6. Security

### 6.1 — [Minor] `SorRefPill` renders `externalRef.deepLinkUrl` as an `href` without sanitisation

**File:** `src/components/cockpit/sor-ref-pill.tsx`, lines 21–24

```tsx
<a href={externalRef.deepLinkUrl} target="_blank" rel="noopener noreferrer">
```

`deepLinkUrl` comes from API data. If the API were compromised or injected with a `javascript:` URL, this would execute arbitrary JavaScript in the user's browser.

**Fix:** Validate that the URL starts with `https://` (or is relative) before rendering the link:

```ts
function isSafeUrl(url: string) {
  return /^https?:\/\//.test(url);
}
```

---

### 6.2 — [Minor] No CSRF token on POST requests

**File:** `src/hooks/queries/use-approvals.ts`, lines 16–23

`postApprovalDecision` posts JSON to the API with no CSRF token or custom header. While SPA-to-API communication using `Content-Type: application/json` is generally safe against simple CSRF (browsers block cross-origin JSON POSTs), if the API ever accepts `application/x-www-form-urlencoded` or `multipart/form-data` this becomes exploitable. At minimum, add a custom `X-Requested-With: XMLHttpRequest` header.

---

### 6.3 — [Minor] `window.location.reload()` in Zustand store bypasses React's rendering model

**File:** `src/stores/ui-store.ts`, line 34

```ts
setActiveDataset: (id) => {
  localStorage.setItem(DATASET_STORAGE_KEY, id);
  window.location.reload();
};
```

A full reload is acceptable here for dataset switching. However, it should be documented clearly (it currently is not) because any pending mutations (e.g., an in-flight approval decision) will be silently aborted.

---

## 7. Code Quality

### 7.1 — [Major] `ApprovalTriageCard` is a monolithic 752-line component

**File:** `src/components/cockpit/approval-triage-card.tsx`

The file contains 9 sub-functions/components plus the main export, all in one file: `SodBanner`, `PolicyRulePanel`, `RequestChangesHistory`, `TriageEffectRow`, `SorBadge`, plus the SoD/policy/history/effects mock getters. This makes the component hard to test, hard to reason about, and hard to modify in isolation.

**Fix:** Split into separate files:

- `sod-banner.tsx` — `SodBanner` + evaluation types
- `policy-rule-panel.tsx` — `PolicyRulePanel`
- `request-changes-history.tsx` — `RequestChangesHistory`
- Move mock data out of the component tree entirely and into MSW handlers

---

### 7.2 — [Major] Mock data duplicates production rendering logic

**File:** `src/components/cockpit/approval-triage-card.tsx`, lines 140–198

`getMockEffects()`, `getSodEvaluation()`, and `getPolicyRule()` are keyed on hardcoded `approvalId` strings. In a production build this dead branch code ships to users. If the live API returns an approval with ID `apr-3002`, the mock SoD evaluation overrides whatever the real API returns for that record.

**Fix:** Move all mock data into MSW handler fixtures (the pattern already exists for other entities in `src/mocks/`).

---

### 7.3 — [Minor] `opColors` record is duplicated

**Files:**

- `src/components/cockpit/effects-list.tsx`, lines 11–16
- `src/components/cockpit/approval-triage-card.tsx`, lines 235–240

Identical `Record<string, string>` mapping operation colors to Tailwind classes. Extract to `src/components/cockpit/lib/effect-colors.ts`.

---

### 7.4 — [Minor] `NavSection` component is unused in the actual navigation

**File:** `src/components/cockpit/nav-section.tsx`

The root layout implements navigation directly with `NavLink`. `NavSection` is an unused abstraction. If it is intentionally kept for reuse, it should at least use TanStack `<Link>` rather than a plain `<a>` (see 1.3).

---

### 7.5 — [Minor] `use-mobile.ts` and `use-mobile.tsx` are duplicate files

**Files:**

- `src/hooks/use-mobile.ts`
- `src/hooks/use-mobile.tsx`

Both files appear to contain the same `useIsMobile` hook. One should be deleted.

---

## 8. Error Boundaries

### 8.1 — [Critical] No error boundaries anywhere in the component tree

**Files:** All route and component files

There are no `React.ErrorBoundary` (or library equivalents) anywhere in the codebase. If any component throws during rendering — for example, `format(new Date(undefined), ...)` if an ISO string is malformed, or a null-dereference in the many `config[status]` lookups — the entire cockpit UI goes blank with an unhandled error.

Specific crash risks:

- `format(new Date(entry.occurredAtIso), ...)` — if `occurredAtIso` is missing or malformed, `new Date(undefined)` returns `Invalid Date` and `date-fns` throws
- `config[status]` lookups in `RunStatusBadge`, `ApprovalStatusBadge`, etc. — if the API returns an unknown status string, the lookup returns `undefined` and the destructure throws

**Fix:**

1. Wrap the root layout's `<Outlet>` in an error boundary that renders a recovery UI
2. Add a route-level error boundary using TanStack Router's `errorComponent` option
3. Defensively guard `config[status]` lookups with a fallback:

```tsx
const { icon: Icon, label, variant, className } = config[status] ?? config['Pending'];
```

---

### 8.2 — [Major] No error state rendering for most query hooks

**Files:** All route files using TanStack Query

The query hooks expose `isError` and `error` properties, but no route file checks them. If `fetchApprovals` throws, the inbox silently shows "No pending approvals" rather than an error message.

**Fix:** Add error state handling in each route:

```tsx
const { data, isLoading, isError, error } = useApprovals(wsId);

if (isError) return <ErrorAlert message={error.message} />;
```

---

### 8.3 — [Major] The Global E-Stop action in `safety.tsx` has no API call — state is local only

**File:** `src/routes/robotics/safety.tsx`, line 144

```tsx
<Button
  variant="destructive"
  onClick={() => {
    setGlobalEstopActive(true);
    setShowEstopModal(false);
  }}
>
  Confirm E-Stop
</Button>
```

The global E-Stop only updates local React state. It does not call any API, persists no real effect, and will reset on page reload. Given this is safety-critical UI, this is the most significant functional bug in the codebase.

**Fix:** Wire up a mutation (`useMutation`) that POSTs to the safety API endpoint before updating local state. Disable the button while the mutation is pending. Handle mutation errors.

---

## 9. Test Coverage

### 9.1 — [Major] Only 2 test files exist for a production-facing operational cockpit

**Files tested:**

- `src/assets/registry.test.ts` — asset registry lookups
- `src/components/domain/entity-components.test.tsx` — static render tests for `EntityIcon` / `EntityImage`

**Not tested (critical paths):**

- `ApprovalTriageCard` — keyboard shortcuts, SoD banner logic, action callbacks, animation sequencing
- `ApprovalGatePanel` — approve/deny/request-changes flow, disabled state when not pending
- `DataTable` — pagination, page size changes, empty state
- `useApprovalDecision` mutation — invalidation after success
- `useTheme` — localStorage read/write, DOM class toggling
- `SafetyPage` — E-Stop confirm dialog (safety-critical)
- All route components — loading/error/empty state rendering
- `FilterBar` — filter value changes, clear button visibility

**Recommendation:** Adopt a test pyramid:

1. Unit tests for pure logic: `buildPageNumbers`, `actorLabel`, `heartbeatLabel`, `initials`, `getSodEvaluation`
2. Integration tests for route components using MSW (already configured) and `@testing-library/react`
3. Consider Storybook interaction tests (the a11y addon is already installed) for badge components

---

### 9.2 — [Minor] `entity-components.test.tsx` uses `renderToStaticMarkup` without a DOM environment

**File:** `src/components/domain/entity-components.test.tsx`

`renderToStaticMarkup` is a server-side render utility. Tests pass `vitest` with a `jsdom` environment — this inconsistency may hide client-side-only rendering bugs (hooks, effects). Use `@testing-library/react`'s `render` instead.

---

## 10. Bundle / Dependency Hygiene

### 10.1 — [Major] `recharts` is a large dependency not lazy-loaded

**File:** `src/routes/explore/observability.tsx`

As noted in section 4.1, Recharts (~300 KB) is imported eagerly. It should be code-split with `React.lazy`.

---

### 10.2 — [Minor] Both `radix-ui` (umbrella) and individual `@radix-ui/*` packages are listed

**File:** `package.json`, lines 15–44 and 53

`radix-ui` (v1.4.3) is a convenience re-export of all Radix primitives. With modern bundlers this is tree-shaken to only used components, but having both it and individual `@radix-ui/react-*` packages creates potential version mismatch risk.

**Fix:** Remove the `radix-ui` umbrella package and rely only on individual `@radix-ui/react-*` packages.

---

### 10.3 — [Minor] `@hookform/resolvers` and `react-hook-form` are listed as dependencies

**File:** `package.json`, lines 14, 57

Neither `react-hook-form` nor `@hookform/resolvers` appear to be used in any source file in the current codebase (no `useForm`, `FormProvider`, or `zodResolver` imports found). These should be removed to reduce bundle size.

---

### 10.4 — [Minor] `embla-carousel-react` and `input-otp` are in dependencies but may be unused

**File:** `package.json`, lines 48, 50

`embla-carousel-react` is used by `src/components/ui/carousel.tsx` (shadcn component) and `input-otp` by `src/components/ui/input-otp.tsx`. Both are shadcn scaffolded UI components not currently used in any route or cockpit component. They contribute to bundle weight.

**Recommendation:** Audit which shadcn components are actually used in routes and cockpit components, and remove unused ones.

---

## Findings Summary

| #    | Severity     | Area             | File                                                      | Description                                                      |
| ---- | ------------ | ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| 8.1  | **Critical** | Error Boundaries | All routes                                                | No error boundaries — crash = blank screen                       |
| 8.3  | **Critical** | Correctness      | `robotics/safety.tsx:144`                                 | Global E-Stop has no API call; local state only                  |
| 2.1  | **Critical** | React            | `approval-triage-card.tsx:485`                            | `useEffect` missing dependency array                             |
| 1.1  | **Major**    | Accessibility    | `__root.tsx`                                              | No skip-to-content link                                          |
| 1.2  | **Major**    | Accessibility    | `__root.tsx:192`                                          | Nav has no `aria-label`; collapsed links have no accessible name |
| 1.3  | **Major**    | Accessibility    | `nav-section.tsx:22`                                      | Plain `<a>` causes full page reload; keyboard focus lost         |
| 2.2  | **Major**    | React            | Multiple files                                            | Array-index keys in several lists                                |
| 2.3  | **Major**    | Code Quality     | `inbox.tsx`, `approval-triage-card.tsx`, `governance.tsx` | Hardcoded mock data in production components                     |
| 2.4  | **Major**    | React            | `explore/events.tsx:13`                                   | Duplicates `useEvidence` query inline                            |
| 3.1  | **Major**    | TypeScript       | `inbox.tsx:198,211`                                       | `as string` casts disable route type checking                    |
| 3.2  | **Major**    | TypeScript       | `data-table.tsx:141`                                      | Unsafe `Record<string, unknown>` cast                            |
| 5.1  | **Major**    | Responsiveness   | `__root.tsx`                                              | Sidebar does not collapse on mobile                              |
| 5.2  | **Major**    | Responsiveness   | `kpi-row.tsx:18`                                          | KPI grid overflows on narrow screens                             |
| 7.1  | **Major**    | Code Quality     | `approval-triage-card.tsx`                                | 752-line monolithic component                                    |
| 7.2  | **Major**    | Code Quality     | `approval-triage-card.tsx`                                | Mock data overrides real API data based on ID matching           |
| 8.2  | **Major**    | Error Handling   | All route files                                           | No `isError` states rendered                                     |
| 9.1  | **Major**    | Test Coverage    | (codebase-wide)                                           | Only 2 test files; critical paths untested                       |
| 10.1 | **Major**    | Bundle           | `observability.tsx`                                       | Recharts not lazy-loaded                                         |
| 1.4  | Minor        | Accessibility    | `workforce-member-card.tsx:24`                            | Clickable card not keyboard-accessible                           |
| 1.5  | Minor        | Accessibility    | `theme-picker.tsx:41`                                     | Active theme button missing `aria-pressed`                       |
| 1.6  | Minor        | Accessibility    | `robotics/robots.tsx:183`                                 | Filter buttons missing `aria-pressed`                            |
| 1.7  | Minor        | Accessibility    | Badge components                                          | Icon not `aria-hidden`                                           |
| 2.5  | Minor        | Performance      | `kpi-row.tsx:18`                                          | Inline `style` with dynamic columns                              |
| 2.6  | Minor        | Code Quality     | `$memberId.tsx`, `workforce-member-card.tsx`              | `initials()` duplicated                                          |
| 2.7  | Minor        | React            | `robots.tsx:83`                                           | Sheet confirm state not reset on robot change                    |
| 3.3  | Minor        | TypeScript       | `events.tsx`, `observability.tsx`                         | Untyped `r.json()` return                                        |
| 3.4  | Minor        | TypeScript       | `approval-triage-card.tsx:541`                            | Unnecessary non-null assertion                                   |
| 3.5  | Minor        | TypeScript       | `safety.tsx:22`                                           | Dead fallback on exhaustive Record                               |
| 5.3  | Minor        | Responsiveness   | `data-table.tsx`                                          | Table missing horizontal scroll wrapper                          |
| 5.4  | Minor        | Responsiveness   | `robots.tsx:167`                                          | `grid-cols-4` missing responsive variant                         |
| 6.1  | Minor        | Security         | `sor-ref-pill.tsx:21`                                     | `deepLinkUrl` rendered without `https://` validation             |
| 6.2  | Minor        | Security         | `use-approvals.ts`                                        | POST mutations have no CSRF token or custom header               |
| 7.3  | Minor        | Code Quality     | `effects-list.tsx`, `approval-triage-card.tsx`            | `opColors` duplicated                                            |
| 7.4  | Minor        | Code Quality     | `nav-section.tsx`                                         | `NavSection` appears unused                                      |
| 7.5  | Minor        | Code Quality     | `hooks/`                                                  | `use-mobile.ts` and `use-mobile.tsx` are duplicates              |
| 9.2  | Minor        | Tests            | `entity-components.test.tsx`                              | `renderToStaticMarkup` instead of `@testing-library/react`       |
| 10.2 | Minor        | Bundle           | `package.json`                                            | `radix-ui` umbrella duplicates individual packages               |
| 10.3 | Minor        | Bundle           | `package.json`                                            | `react-hook-form` / `@hookform/resolvers` appear unused          |
| 10.4 | Minor        | Bundle           | `package.json`                                            | Possibly unused shadcn components inflate bundle                 |

---

## Recommended Priority Order

1. **Add error boundaries** (Critical — prevents entire app blank-screen on any render error)
2. **Wire E-Stop to real API** (Critical — safety-critical feature currently no-ops)
3. **Fix `useEffect` missing dependency array** in `ApprovalTriageCard` (Critical — correctness/reliability)
4. **Add error states to all query-backed routes** (Major — currently fails silently)
5. **Remove hardcoded mock data from production components** (Major — would ship stub data to real users)
6. **Fix mobile responsiveness** — sidebar drawer, KPI grid, table scroll (Major — core usability)
7. **Fix `as string` route casts** once all routes are registered (Major — type safety)
8. **Add test coverage** for critical paths: approval flow, E-Stop confirmation, data table pagination (Major)
9. **Lazy-load Recharts** (Major — performance)
10. **Fix index keys in lists** (Major — React correctness)
