// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { DiffHunk, EvidenceEntry } from '@portarium/cockpit-types';
import { DiffApprovalSurface } from './diff-approval-surface';

const hunk: DiffHunk = {
  hunkId: 'h1',
  filePath: 'src/example.ts',
  changeType: 'modified',
  oldStart: 1,
  oldCount: 1,
  newStart: 1,
  newCount: 2,
  lines: [
    { op: 'remove', oldLineNumber: 1, content: 'const enabled = false;' },
    { op: 'add', newLineNumber: 1, content: 'const enabled = true;' },
    { op: 'add', newLineNumber: 2, content: 'export { enabled };' },
  ],
};

const evidence: EvidenceEntry[] = [
  {
    schemaVersion: 1,
    evidenceId: 'ev-1',
    workspaceId: 'ws-demo',
    occurredAtIso: '2026-04-01T00:00:00.000Z',
    category: 'Plan',
    summary: 'Plan generated',
    actor: { kind: 'System' },
    hashSha256: 'sha256:1',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-2',
    workspaceId: 'ws-demo',
    occurredAtIso: '2026-04-01T00:01:00.000Z',
    category: 'Approval',
    summary: 'Approval requested',
    actor: { kind: 'User', userId: 'user-1' },
    hashSha256: 'sha256:2',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-3',
    workspaceId: 'ws-demo',
    occurredAtIso: '2026-04-01T00:02:00.000Z',
    category: 'Action',
    summary: 'Action staged',
    actor: { kind: 'Machine', machineId: 'machine-1' },
    hashSha256: 'sha256:3',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-4',
    workspaceId: 'ws-demo',
    occurredAtIso: '2026-04-01T00:03:00.000Z',
    category: 'System',
    summary: 'Hidden older entry',
    actor: { kind: 'System' },
    hashSha256: 'sha256:4',
  },
];

let triggerIntersect: ((entries: IntersectionObserverEntry[]) => void) | undefined;

beforeEach(() => {
  triggerIntersect = undefined;
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(function IntersectionObserverMock(callback: IntersectionObserverCallback) {
      triggerIntersect = callback as (entries: IntersectionObserverEntry[]) => void;
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
        takeRecords: vi.fn(() => []),
      };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderSurface(onDecide = vi.fn()) {
  render(
    <DiffApprovalSurface
      beadId="bead-0976"
      approvalId="apr-1"
      policyTier="HumanApprove"
      policyRationale="Agent proposes code changes that need operator review."
      blastRadius="2 files"
      isIrreversible={false}
      hunks={[hunk]}
      recentEvidence={evidence}
      onDecide={onDecide}
    />,
  );
}

describe('DiffApprovalSurface', () => {
  it('renders diff hunks and only the last three evidence entries', () => {
    renderSurface();

    expect(screen.getByText('src/example.ts')).toBeTruthy();
    expect(screen.getByText('const enabled = true;')).toBeTruthy();
    expect(screen.getByText('Plan generated')).toBeTruthy();
    expect(screen.getByText('Approval requested')).toBeTruthy();
    expect(screen.getByText('Action staged')).toBeTruthy();
    expect(screen.queryByText('Hidden older entry')).toBeNull();
  });

  it('keeps decisions disabled until the diff is read and rationale is long enough', async () => {
    const onDecide = vi.fn();
    renderSurface(onDecide);

    const approve = screen.getByRole<HTMLButtonElement>('button', { name: /approve/i });
    expect(approve.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/decision rationale/i), {
      target: { value: 'Looks safe' },
    });
    expect(approve.disabled).toBe(true);

    triggerIntersect?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    await waitFor(() => expect(approve.disabled).toBe(false));

    fireEvent.click(approve);
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith('Approved', 'Looks safe'));
  });

  it('keeps the primary decision disabled before the read gate is satisfied', () => {
    renderSurface();
    const approve = screen.getByRole<HTMLButtonElement>('button', { name: /approve/i });
    fireEvent.click(approve);
    expect(approve.disabled).toBe(true);
  });
});
