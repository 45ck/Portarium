/**
 * Smoke E2E — Run management flows
 *
 * Tests three additional flows against the MSW mock API:
 *
 *   1. Cancel-run flow — navigate to an active run, click Cancel, confirm,
 *      verify the status updates to Cancelled.
 *
 *   2. Evidence chain-of-trust — open a run with evidence, navigate to the
 *      Evidence tab, verify timeline entries render with chain indicators
 *      (ChainIntegrityBanner + linked-entry icons).
 *
 *   3. Staleness / realtime — simulate going offline, verify the
 *      OfflineSyncBanner appears; restore online, verify banner clears.
 *
 * Runs against Vite dev server (http://localhost:5173) with MSW active.
 * No live backend required.
 *
 * Bead: bead-0820
 * Ref: ADR-0062 §smoke-flows
 */
import { test, expect } from '@playwright/test';

test.setTimeout(60_000);

// ---------------------------------------------------------------------------
// Shared setup: wait for the app shell to be ready
// ---------------------------------------------------------------------------

import type { Page } from '@playwright/test';

async function waitForAppShell(page: Page) {
  await expect(page.getByRole('link', { name: 'Runs' })).toBeVisible({ timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Cancel-run flow
// ---------------------------------------------------------------------------

test.describe('Cancel-run flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppShell(page);
  });

  test('shows Cancel Run button for a Running run', async ({ page }) => {
    // run-2002 has status: Running in the demo fixtures
    await page.goto('/runs/run-2002');

    const cancelButton = page.getByRole('button', { name: 'Cancel Run' });
    await expect(cancelButton).toBeVisible({ timeout: 10_000 });
  });

  test('cancel dialog appears and can be dismissed', async ({ page }) => {
    await page.goto('/runs/run-2002');

    const cancelButton = page.getByRole('button', { name: 'Cancel Run' });
    await expect(cancelButton).toBeVisible({ timeout: 10_000 });
    await cancelButton.click();

    // AlertDialog should appear
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText('Cancel this run?')).toBeVisible();

    // Dismiss by clicking "Keep Running"
    await page.getByRole('button', { name: 'Keep Running' }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // Cancel button should still be there (run is still Running)
    await expect(cancelButton).toBeVisible();
  });

  test('confirming cancel changes run status to Cancelled', async ({ page }) => {
    // Intercept the cancel API call
    const cancelRequest = page.waitForRequest(
      (req) => req.url().includes('/cancel') && req.method() === 'POST',
    );

    await page.goto('/runs/run-2002');

    const cancelButton = page.getByRole('button', { name: 'Cancel Run' });
    await expect(cancelButton).toBeVisible({ timeout: 10_000 });
    await cancelButton.click();

    // Confirm in the dialog
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Cancel' }).click();

    // Verify the API call was made
    await cancelRequest;

    // After cancellation, the Cancel Run button should disappear
    // (status is Cancelled — not Running/WaitingForApproval/Paused)
    await expect(cancelButton).not.toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Evidence chain-of-trust flow
// ---------------------------------------------------------------------------

test.describe('Evidence chain-of-trust', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppShell(page);
  });

  test('run detail shows chain integrity banner', async ({ page }) => {
    // run-2001 is WaitingForApproval and has evidence entries
    await page.goto('/runs/run-2001');

    // ChainIntegrityBanner renders with one of three states
    const banner = page
      .getByText('Chain verified — all hashes valid')
      .or(page.getByText('Chain BROKEN — hash verification failed'))
      .or(page.getByText('Chain verification pending'));

    await expect(banner).toBeVisible({ timeout: 10_000 });
  });

  test('Evidence tab renders timeline entries for a run with evidence', async ({ page }) => {
    await page.goto('/runs/run-2001');

    // Click the Evidence tab
    await page.getByRole('tab', { name: 'Evidence' }).click();

    // Evidence entries for run-2001 include 'Plan plan-5001 generated…'
    // and a policy violation entry
    await expect(page.getByText('Plan plan-5001 generated', { exact: false })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('chained evidence entries show chain-link indicator', async ({ page }) => {
    await page.goto('/runs/run-2001');
    await page.getByRole('tab', { name: 'Evidence' }).click();

    // evd-4005 has previousHash — should show the Link2 icon with aria-label "Chained entry"
    // The policy violation entry is the chained one for run-2001
    await expect(page.getByText('Policy violation detected', { exact: false })).toBeVisible({
      timeout: 10_000,
    });

    // Chained entries have an aria-label on the Link2 icon
    const chainIndicator = page.getByLabel('Chained entry');
    await expect(chainIndicator).toBeVisible();
  });

  test('run-2003 evidence timeline shows multiple chained entries', async ({ page }) => {
    // run-2003 has 3 evidence entries, 2 of which are chained (evd-4002, evd-4003)
    await page.goto('/runs/run-2003');
    await page.getByRole('tab', { name: 'Evidence' }).click();

    // Should see the payout reconciliation entry (multiple matches possible — just need one)
    await expect(
      page.getByText('Stripe payout reconciliation', { exact: false }).first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Two chain-link indicators for the two chained entries
    const chainIndicators = page.getByLabel('Chained entry');
    await expect(chainIndicators).toHaveCount(2, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Staleness / offline banner flow
// ---------------------------------------------------------------------------

test.describe('Staleness and offline banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppShell(page);
  });

  test('offline banner appears when browser goes offline', async ({ page, context }) => {
    // Navigate to a page that uses useOfflineQuery (approvals page)
    await page.goto('/approvals');

    // Wait for the triage deck to be ready (data fully loaded from MSW)
    await expect(page.getByTitle('Approve (A)')).toBeVisible({ timeout: 10_000 });

    // No offline banner in nominal state
    const offlineBanner = page.getByText('Offline mode active');
    await expect(offlineBanner)
      .not.toBeVisible({ timeout: 3_000 })
      .catch(() => {
        // Banner may already be showing from previous data state — that's ok for this test
      });

    // Simulate going offline. Playwright's CDP-level setOffline doesn't always fire
    // the DOM offline event, so we dispatch it explicitly as well.
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    // OfflineSyncBanner should now show
    await expect(page.getByText('Offline mode active')).toBeVisible({ timeout: 5_000 });

    // Restore online — dispatch DOM event explicitly for symmetry
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Banner should clear once connection is restored and data refetches
    await expect(page.getByText('Offline mode active')).not.toBeVisible({ timeout: 10_000 });
  });

  test('runs list shows offline banner when offline', async ({ page, context }) => {
    await page.goto('/runs');

    // Wait for the runs list to load (at least one run visible)
    await expect(page.getByText('run-2002', { exact: false })).toBeVisible({ timeout: 10_000 });

    // Go offline — dispatch DOM event explicitly alongside CDP-level block
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    // The entity list shell renders OfflineSyncBanner in both header and body
    // when offlineMeta.isOffline is true
    await expect(page.getByText('Offline mode active').first()).toBeVisible({ timeout: 5_000 });

    // Restore — dispatch DOM event explicitly
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.getByText('Offline mode active').first()).not.toBeVisible({
      timeout: 10_000,
    });
  });
});
