// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

let mockIsOnline = true;
let mockPendingCount = 0;

vi.mock('@/hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => ({
    isOnline: mockIsOnline,
    pendingCount: mockPendingCount,
    enqueue: vi.fn(),
    drain: vi.fn(),
  }),
}));

import { OfflineIndicator } from '@/components/cockpit/offline-indicator';

describe('OfflineIndicator', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockIsOnline = true;
    mockPendingCount = 0;
  });

  it('renders nothing when online with zero pending', () => {
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('shows pending count when online with queued items', () => {
    mockIsOnline = true;
    mockPendingCount = 3;
    render(<OfflineIndicator />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('3 pending');
  });

  it('shows offline status when browser is offline', () => {
    mockIsOnline = false;
    mockPendingCount = 0;
    render(<OfflineIndicator />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Offline');
  });

  it('shows offline with pending count', () => {
    mockIsOnline = false;
    mockPendingCount = 2;
    render(<OfflineIndicator />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Offline');
    expect(status.textContent).toContain('2 pending');
  });
});
