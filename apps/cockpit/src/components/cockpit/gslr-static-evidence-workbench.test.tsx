// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGslrStaticEvidenceWorkbenchOperatorReportPacketV1,
  GslrStaticEvidenceWorkbench,
  runGslrStaticEvidenceWorkbenchDryRun,
  serializeGslrStaticEvidenceWorkbenchOperatorReportPacketV1,
} from './gslr-static-evidence-workbench';
import { GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES } from './gslr-manual-bundle-preview-fixtures';

const NOW_ISO = '2026-05-13T04:30:00.000Z';
const DRY_RUN_AT_ISO = '2026-05-13T05:00:00.000Z';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

  it('builds a deterministic static operator report export packet', () => {
    const result = runGslrStaticEvidenceWorkbenchDryRun({
      bundleText: GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES[0].bundleJson,
      sourceRef: 'fixtures/gslr20/gslr8-route-record-compiler-test-fixture.bundle.json',
      nowIso: NOW_ISO,
      dryRunAtIso: DRY_RUN_AT_ISO,
      actor: 'operator:test',
    });

    expect(result.kind).toBe('dry-run');
    if (result.kind !== 'dry-run') return;

    const packet = buildGslrStaticEvidenceWorkbenchOperatorReportPacketV1(result.result);
    const serialized = serializeGslrStaticEvidenceWorkbenchOperatorReportPacketV1(packet);

    expect(packet.schemaVersion).toBe(
      'portarium.gslr-static-evidence-workbench-operator-report.v1',
    );
    expect(packet.route).toBe('/engineering/evidence-cards/workbench');
    expect(packet.dryRunStatus).toBe('planned-blocked');
    expect(packet.plan.blockers).toContain(
      'verified records require production-keyring signer trust before import',
    );
    expect(packet.repository.entries).toBe(0);
    expect(packet.boundaryWarnings.join(' ')).toContain('does not poll prompt-language manifests');
    expect(packet.reportText).toContain('boundary: static review only');
    expect(packet.filename).toMatch(/operator-report\.json$/);
    expect(JSON.parse(serialized)).toMatchObject({
      schemaVersion: packet.schemaVersion,
      sourceRef: packet.sourceRef,
      dryRunStatus: 'planned-blocked',
    });
    expect(Object.isFrozen(packet)).toBe(true);
    expect(Object.isFrozen(packet.plan)).toBe(true);
    expect(Object.isFrozen(packet.repository)).toBe(true);
  });

  it('copies and prepares the operator report export without live endpoint calls', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const createObjectURL = vi.fn(() => 'blob:operator-report');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    const anchorClick = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', {
          configurable: true,
          value: anchorClick,
        });
      }
      return element as HTMLElement;
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<GslrStaticEvidenceWorkbench />);

    fireEvent.click(screen.getByRole('button', { name: /Run dry-run/i }));
    fireEvent.click(screen.getByRole('button', { name: /Copy JSON/i }));
    fireEvent.click(screen.getByRole('button', { name: /Download JSON/i }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining(
        '"schemaVersion": "portarium.gslr-static-evidence-workbench-operator-report.v1"',
      ),
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:operator-report');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
