/**
 * Responsive layout E2E tests
 *
 * Verifies that the Cockpit app renders correctly across the supported viewport
 * matrix.  Tests are purely structural — they check visibility, element
 * presence, and layout behaviour rather than business logic.
 *
 * Layout rules under test:
 *
 *   Desktop (≥ 768px wide)
 *     - Desktop sidebar is visible (role="complementary" / aside)
 *     - Mobile bottom navigation is NOT visible
 *     - Filter toolbar items are on a single row (no overflow)
 *     - Approvals dual-panel shows the left panel
 *
 *   Mobile (< 768px wide)
 *     - Desktop sidebar is NOT visible
 *     - Mobile bottom navigation IS visible (fixed bottom nav)
 *     - Filter toolbar wraps (items still accessible, no horizontal scroll)
 *
 *   Tablet boundary (768px)
 *     - Treated the same as desktop by the `useIsMobile()` hook (strictly < 768)
 *     - Sidebar visible, bottom nav hidden
 *
 * Runs against the Vite dev server (MSW active, no live backend required).
 *
 * Bead: bead-0828
 * Ref: ADR-0062 §viewport-matrix
 */
import { test, expect, type Page } from '@playwright/test';

test.setTimeout(60_000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForAppShell(page: Page) {
  // Wait for the app shell to hydrate — either desktop sidebar or mobile nav
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .or(page.getByRole('navigation', { name: 'Bottom navigation' })),
  ).toBeVisible({ timeout: 20_000 });
}

function isMobileViewport(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

// ---------------------------------------------------------------------------
// Navigation collapse — desktop vs mobile
// ---------------------------------------------------------------------------

test.describe('Navigation layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppShell(page);
  });

  test('desktop: sidebar visible, bottom nav hidden', async ({ page }) => {
    test.skip(isMobileViewport(page), 'Desktop-only test');

    // Desktop sidebar wraps nav links — identified by aria-label
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();

    // Bottom nav is rendered only for mobile
    await expect(page.getByRole('navigation', { name: 'Bottom navigation' })).not.toBeVisible();
  });

  test('mobile: bottom nav visible, desktop sidebar hidden', async ({ page }) => {
    test.skip(!isMobileViewport(page), 'Mobile-only test');

    // Mobile bottom navigation bar
    await expect(page.getByRole('navigation', { name: 'Bottom navigation' })).toBeVisible();

    // Desktop sidebar should be hidden on mobile
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).not.toBeVisible();
  });

  test('primary nav destinations are accessible on all viewports', async ({ page }) => {
    // All viewports: key nav links must be reachable (sidebar or bottom nav)
    if (isMobileViewport(page)) {
      // Mobile: primary destinations live in the bottom nav
      const bottomNav = page.getByRole('navigation', { name: 'Bottom navigation' });
      await expect(bottomNav).toBeVisible();
      // Runs and Approvals must be reachable
      await expect(bottomNav.getByRole('link', { name: 'Runs' })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: 'Approvals' })).toBeVisible();
    } else {
      // Desktop: primary destinations in sidebar
      const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
      await expect(sidebar.getByRole('link', { name: 'Runs' })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: 'Approvals' })).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Filter bar — responsive wrap
// ---------------------------------------------------------------------------

test.describe('Filter toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/runs');
    await waitForAppShell(page);
  });

  test('filter toolbar renders without horizontal overflow', async ({ page }) => {
    // The filter toolbar uses flex-wrap — items should not spill out of the viewport.
    // We check that the toolbar's scroll width does not exceed the viewport width.
    const overflowing = await page.evaluate(() => {
      // Look for elements with a class name containing "filter" or "toolbar"
      const candidates = Array.from(
        document.querySelectorAll('[class*="filter"], [class*="toolbar"], [role="search"]'),
      );
      return candidates.some((el) => el.scrollWidth > el.clientWidth + 1);
    });
    expect(overflowing).toBe(false);
  });

  test('runs list renders content on all viewports', async ({ page }) => {
    // The runs list must show content regardless of viewport.
    // demo fixtures include run-2002 and run-2001.
    await expect(
      page.getByText('run-2002', { exact: false }).or(page.getByText('run-2001', { exact: false })),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Approvals page layout
// ---------------------------------------------------------------------------

test.describe('Approvals page layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/approvals');
    await waitForAppShell(page);
  });

  test('approvals page loads without JS errors on all viewports', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Give the page time to settle
    await page.waitForTimeout(1000);

    expect(errors).toHaveLength(0);
  });

  test('approvals heading is visible on all viewports', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Approvals', exact: false }).or(
        // Some layouts render a breadcrumb/page title instead of an h1
        page.getByText('Approvals', { exact: false }).first(),
      ),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Runs detail page — cross-viewport sanity
// ---------------------------------------------------------------------------

test.describe('Run detail page', () => {
  test('run detail page renders on all viewports', async ({ page }) => {
    await page.goto('/runs/run-2001');
    await waitForAppShell(page);

    // The run title/id should be visible regardless of viewport
    await expect(page.getByText('run-2001', { exact: false })).toBeVisible({ timeout: 10_000 });
  });
});
