import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const COCKPIT_HTML_PATH = path.join(process.cwd(), 'docs/internal/ui/cockpit/index.html');

const DEMO_NAV_LOCATORS = [
  { testId: 'demo-nav-inbox', href: '#inbox' },
  { testId: 'demo-nav-work-item', href: '#work-item' },
  { testId: 'demo-nav-runs', href: '#runs' },
  { testId: 'demo-nav-approvals', href: '#approvals' },
  { testId: 'demo-nav-evidence', href: '#evidence' },
  { testId: 'demo-nav-settings', href: '#settings' },
] as const;

const DEMO_SCREEN_LOCATORS = [
  { testId: 'demo-screen-inbox', screenId: 'screen-inbox' },
  { testId: 'demo-screen-work-item', screenId: 'screen-work-item' },
  { testId: 'demo-screen-run', screenId: 'screen-run' },
  { testId: 'demo-screen-approvals', screenId: 'screen-approvals' },
  { testId: 'demo-screen-evidence', screenId: 'screen-evidence' },
  { testId: 'demo-screen-settings', screenId: 'screen-settings' },
] as const;

describe('cockpit demo locator anchors', () => {
  it('includes stable data-testid navigation anchors for scripted demos', async () => {
    const html = await readFile(COCKPIT_HTML_PATH, 'utf8');

    for (const locator of DEMO_NAV_LOCATORS) {
      const pattern = new RegExp(
        `<a(?=[^>]*\\bdata-testid="${escapeRegex(locator.testId)}")(?=[^>]*\\bhref="${escapeRegex(locator.href)}")[^>]*>`,
      );
      expect(
        pattern.test(html),
        `Expected nav anchor ${locator.testId} -> ${locator.href} in ${COCKPIT_HTML_PATH}`,
      ).toBe(true);
    }
  });

  it('includes stable data-testid screen anchors for demo-critical surfaces', async () => {
    const html = await readFile(COCKPIT_HTML_PATH, 'utf8');

    for (const locator of DEMO_SCREEN_LOCATORS) {
      const pattern = new RegExp(
        `<section(?=[^>]*\\bid="${escapeRegex(locator.screenId)}")(?=[^>]*\\bdata-testid="${escapeRegex(locator.testId)}")[^>]*>`,
      );
      expect(
        pattern.test(html),
        `Expected screen section ${locator.screenId} with ${locator.testId} in ${COCKPIT_HTML_PATH}`,
      ).toBe(true);
    }
  });
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
