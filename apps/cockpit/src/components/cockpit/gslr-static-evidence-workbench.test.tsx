// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GslrStaticEvidenceWorkbench,
  runGslrStaticEvidenceWorkbenchDryRun,
} from './gslr-static-evidence-workbench';
import { GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES } from './gslr-manual-bundle-preview-fixtures';

const NOW_ISO = '2026-05-13T04:30:00.000Z';
const DRY_RUN_AT_ISO = '2026-05-13T05:00:00.000Z';

afterEach(() => {
  cleanup();
});

describe('GslrStaticEvidenceWorkbench', () => {
  it('blocks checked-in test-signature fixtures from accepted import', () => {
    const result = runGslrStaticEvidenceWorkbenchDryRun({
      bundleText: GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES[0].bundleJson,
      sourceRef: 'fixtures/gslr20/gslr8-route-record-compiler-test-fixture.bundle.json',
      nowIso: NOW_ISO,
      dryRunAtIso: DRY_RUN_AT_ISO,
      actor: 'operator:test',
    });

    expect(result.kind).toBe('dry-run');
    if (result.kind !== 'dry-run') return;

    expect(result.result.status).toBe('planned-blocked');
    expect(result.result.plan.blockers).toContain(
      'verified records require production-keyring signer trust before import',
    );
    expect(result.result.repositoryEntries).toHaveLength(0);
  });

  it('renders accepted, blocked, and quarantined dry-run states', () => {
    render(<GslrStaticEvidenceWorkbench />);

    fireEvent.click(screen.getByRole('button', { name: /Run dry-run/i }));

    expect(screen.getByText('Dry-run stored static record')).toBeTruthy();
    expect(screen.getByText('Signer trust')).toBeTruthy();
    expect(screen.getByText('production-keyring')).toBeTruthy();
    expect(screen.getByText('Audit event')).toBeTruthy();
    expect(screen.getByText('record_appended')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /GSLR-8 test-signature blocked/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run dry-run/i }));

    expect(screen.getByText('Dry-run blocked before append')).toBeTruthy();
    expect(
      screen.getByText('verified records require production-keyring signer trust before import'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Invalid signature quarantine/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run dry-run/i }));

    expect(screen.getByText('quarantined_rejected')).toBeTruthy();
    expect(screen.getAllByText('signature_invalid / signature').length).toBeGreaterThan(0);
    expect(
      screen.getByText((content) => content.includes('boundary: static review only')),
    ).toBeTruthy();
  });
});
