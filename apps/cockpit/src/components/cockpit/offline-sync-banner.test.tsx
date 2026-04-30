// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OfflineSyncBanner } from '@/components/cockpit/offline-sync-banner';

describe('OfflineSyncBanner', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('does not suppress cached-data warnings when MSW is explicitly disabled', () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'false');

    render(
      <OfflineSyncBanner isOffline={false} isStaleData lastSyncAtIso="2026-04-30T00:00:00.000Z" />,
    );

    expect(screen.getByText('Showing cached data')).toBeTruthy();
  });

  it('suppresses cached-data warnings in explicit demo runtime', () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'true');

    const { container } = render(<OfflineSyncBanner isOffline={false} isStaleData />);

    expect(container.firstChild).toBeNull();
  });
});
