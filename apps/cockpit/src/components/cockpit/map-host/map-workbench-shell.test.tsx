// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MapWorkbenchShell } from './map-workbench-shell';
import type { MapHostDataState, MapHostPanelTab } from './types';

type TestTabId = 'details' | 'events' | 'disabled';

const tabs: readonly MapHostPanelTab<TestTabId>[] = [
  { id: 'details', label: 'Details', count: 2 },
  { id: 'events', label: 'Events' },
  { id: 'disabled', label: 'Disabled', disabled: true },
];

function renderShell({
  activeTab = 'details',
  dataState = 'ready',
  onTabChange = vi.fn(),
}: {
  activeTab?: TestTabId;
  dataState?: MapHostDataState;
  onTabChange?: (tabId: TestTabId) => void;
} = {}) {
  return {
    onTabChange,
    ...render(
      <MapWorkbenchShell
        title="Operations map"
        subtitle="Live geography"
        dataState={dataState}
        map={<div aria-label="map canvas">Map content</div>}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        panel={<div>Panel content</div>}
        toolbar={<button type="button">Refresh map</button>}
        status={<span>Synced</span>}
        selectionLabel="Selected: Site Alpha"
      />,
    ),
  };
}

afterEach(() => {
  cleanup();
});

describe('MapWorkbenchShell', () => {
  it('renders desktop and mobile workbench structure with shared map, toolbar, and panel content', () => {
    const { container } = renderShell();

    const shell = container.querySelector('section[data-state="ready"]');
    expect(shell).not.toBeNull();

    const layouts = Array.from(container.querySelectorAll('section[data-state="ready"] > div'));
    expect(layouts).toHaveLength(2);
    expect(layouts.every((layout) => layout.getAttribute('data-state') === 'ready')).toBe(true);
    expect(layouts[0]?.className).toContain('md:flex');
    expect(layouts[1]?.className).toContain('md:hidden');

    expect(screen.getAllByLabelText('map canvas')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Refresh map' })).toHaveLength(2);
    expect(screen.getAllByText('Operations map')).toHaveLength(2);
    expect(screen.getAllByText('Live geography')).toHaveLength(2);
    expect(screen.getAllByText('Synced')).toHaveLength(2);
    expect(screen.getAllByText('Selected: Site Alpha')).toHaveLength(2);
    expect(screen.getAllByText('Panel content')).toHaveLength(2);
  });

  it('propagates data-state to shell and responsive layout hosts', () => {
    const { container } = renderShell({ dataState: 'loading' });

    expect(container.querySelector('section[data-state="loading"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-state="loading"]')).toHaveLength(3);
  });

  it('marks active tabs and invokes the tab change callback when an enabled tab is clicked', async () => {
    const user = userEvent.setup();
    const { onTabChange } = renderShell({ activeTab: 'details' });

    const tablists = screen.getAllByRole('tablist');
    expect(tablists).toHaveLength(2);

    const desktopTabs = within(tablists[0] as HTMLElement);
    expect(desktopTabs.getByRole('tab', { name: 'Details 2' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(desktopTabs.getByRole('tab', { name: 'Events' }).getAttribute('aria-selected')).toBe(
      'false',
    );

    await user.click(desktopTabs.getByRole('tab', { name: 'Events' }));

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith('events');
  });

  it('renders disabled panel tabs without firing tab changes', async () => {
    const user = userEvent.setup();
    const { onTabChange } = renderShell();

    const disabledTab = within(screen.getAllByRole('tablist')[0] as HTMLElement).getByRole('tab', {
      name: 'Disabled',
    });
    expect(disabledTab.hasAttribute('disabled')).toBe(true);

    await user.click(disabledTab);

    expect(onTabChange).not.toHaveBeenCalled();
  });
});
