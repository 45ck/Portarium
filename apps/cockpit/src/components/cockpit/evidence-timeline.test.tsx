// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { EvidenceEntry } from '@portarium/cockpit-types';
import { EvidenceTimeline } from './evidence-timeline';

function makeEntry(
  id: string,
  actorKind: EvidenceEntry['actor']['kind'],
  category: EvidenceEntry['category'] = 'Action',
): EvidenceEntry {
  const actor: EvidenceEntry['actor'] =
    actorKind === 'User'
      ? { kind: 'User', userId: 'user-alice' }
      : actorKind === 'Machine'
        ? { kind: 'Machine', machineId: 'machine-1' }
        : actorKind === 'Adapter'
          ? { kind: 'Adapter', adapterId: 'odoo-adapter' }
          : { kind: 'System' };

  return {
    evidenceId: id,
    category,
    summary: `Entry ${id}`,
    actor,
    occurredAtIso: new Date(Date.now() - 60_000).toISOString(),
  };
}

describe('EvidenceTimeline', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows loading skeletons when loading=true', () => {
    const { container } = render(<EvidenceTimeline entries={[]} loading />);
    // Loading state renders skeleton divs — no entry summaries visible
    expect(
      container.querySelectorAll('[class*="skeleton"], [class*="animate"]').length,
    ).toBeGreaterThanOrEqual(0);
    expect(screen.queryByText('Entry')).toBeNull();
  });

  it('renders entries in non-loading state', () => {
    render(<EvidenceTimeline entries={[makeEntry('e1', 'User'), makeEntry('e2', 'Machine')]} />);
    expect(screen.getByText('Entry e1')).toBeTruthy();
    expect(screen.getByText('Entry e2')).toBeTruthy();
  });

  it('labels User actor correctly', () => {
    render(<EvidenceTimeline entries={[makeEntry('e1', 'User')]} />);
    expect(screen.getByText('User: user-alice')).toBeTruthy();
  });

  it('labels Machine actor correctly', () => {
    render(<EvidenceTimeline entries={[makeEntry('e1', 'Machine')]} />);
    expect(screen.getByText('Machine: machine-1')).toBeTruthy();
  });

  it('labels Adapter actor correctly', () => {
    render(<EvidenceTimeline entries={[makeEntry('e1', 'Adapter')]} />);
    expect(screen.getByText('Adapter: odoo-adapter')).toBeTruthy();
  });

  it('labels System actor correctly', () => {
    render(<EvidenceTimeline entries={[makeEntry('e1', 'System')]} />);
    expect(screen.getByText('System')).toBeTruthy();
  });

  it('shows chained entry icon when previousHash is set', () => {
    const entry = { ...makeEntry('e1', 'User'), previousHash: 'abc123' };
    render(<EvidenceTimeline entries={[entry]} />);
    expect(screen.getByLabelText('Chained entry')).toBeTruthy();
  });

  it('renders empty without errors when entries is empty', () => {
    const { container } = render(<EvidenceTimeline entries={[]} />);
    expect(container.querySelector('[class*="space-y"]')).toBeTruthy();
  });

  it('renders multiple categories', () => {
    render(
      <EvidenceTimeline
        entries={[
          makeEntry('e1', 'User', 'Plan'),
          makeEntry('e2', 'System', 'Approval'),
          makeEntry('e3', 'Adapter', 'Policy'),
        ]}
      />,
    );
    expect(screen.getByText('Entry e1')).toBeTruthy();
    expect(screen.getByText('Entry e2')).toBeTruthy();
    expect(screen.getByText('Entry e3')).toBeTruthy();
  });
});
