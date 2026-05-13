// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GslrManualBundlePreview,
  sha256Hex,
  verifyGslrManualBundlePreview,
} from './gslr-manual-bundle-preview';
import { GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES } from './gslr-manual-bundle-adversarial-fixtures';
import { GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES } from './gslr-manual-bundle-preview-fixtures';

const NOW_ISO = '2026-05-13T02:00:00.000Z';

afterEach(() => {
  cleanup();
});

describe('GslrManualBundlePreview', () => {
  it('uses a real SHA-256 implementation for payload verification', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('verifies the checked-in GSLR-8 and GSLR-7 sample bundle JSON', () => {
    const results = GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES.map((fixture) =>
      verifyGslrManualBundlePreview(fixture.bundleJson, NOW_ISO),
    );

    expect(results.map((result) => result.kind)).toEqual(['verified', 'verified']);
    expect(results[0]?.kind === 'verified' ? results[0].card.actionStatus : null).toBe(
      'research-only',
    );
    expect(results[1]?.kind === 'verified' ? results[1].card.actionStatus : null).toBe('blocked');
  });

  it('rejects tampered bundles before static card projection', () => {
    const tampered = GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES[0].bundleJson.replace(
      'gslr8-route-record-compiler',
      'gslr8-route-record-compiler-tampered',
    );

    const result = verifyGslrManualBundlePreview(tampered, NOW_ISO);

    expect(result.kind).toBe('rejected');
    expect(result.kind === 'rejected' ? result.errorMessage : '').toMatch(/payloadHashSha256/);
  });

  it('rejects every checked-in adversarial bundle fixture with a targeted check row', () => {
    for (const fixture of GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES) {
      const result = verifyGslrManualBundlePreview(fixture.bundleJson, NOW_ISO);

      expect(result.kind, fixture.caseId).toBe('rejected');
      expect(result.kind === 'rejected' ? result.errorMessage : '', fixture.caseId).toMatch(
        fixture.expectedErrorPattern,
      );
      expect(
        result.checks.some(
          (check) => check.label === fixture.expectedCheckLabel && check.status === 'rejected',
        ),
        fixture.caseId,
      ).toBe(true);
    }
  });

  it('renders rejected adversarial bundles without projecting a static card', () => {
    render(<GslrManualBundlePreview />);

    fireEvent.click(screen.getByRole('button', { name: /Invalid signature/i }));
    fireEvent.click(screen.getByRole('button', { name: /Verify bundle/i }));

    expect(screen.getByText('Bundle verification rejected')).toBeTruthy();
    expect(screen.getByText('Signature')).toBeTruthy();
    expect(screen.queryByText('Bundle verified')).toBeNull();
    expect(screen.queryByText('gslr8-route-record-compiler')).toBeNull();
  });

  it('renders the static evidence card only after verification passes', () => {
    render(<GslrManualBundlePreview />);

    expect(screen.queryByText('gslr8-route-record-compiler')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Verify bundle/i }));

    expect(screen.getByText('Bundle verified')).toBeTruthy();
    expect(screen.getByText('gslr8-route-record-compiler')).toBeTruthy();
    expect(screen.getByText('Manual static preview only')).toBeTruthy();
  });
});
