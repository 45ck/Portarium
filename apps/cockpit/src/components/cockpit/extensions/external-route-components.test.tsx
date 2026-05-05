// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { INSTALLED_COCKPIT_ROUTE_LOADERS } from '@/lib/extensions/installed';
import { EXAMPLE_REFERENCE_EXTENSION } from '@/lib/extensions/example-reference/manifest';
import type { ResolvedCockpitExtension } from '@/lib/extensions/types';
import {
  createHostedExternalRouteComponent,
  HOSTED_EXTERNAL_ROUTE_COMPONENTS,
} from './external-route-components';

const route = EXAMPLE_REFERENCE_EXTENSION.routes[0]!;
const resolvedExtension = {
  manifest: EXAMPLE_REFERENCE_EXTENSION,
  status: 'enabled',
  disableReasons: [],
  problems: [],
  workspacePackRefs: [{ packId: 'example.reference' }],
} satisfies ResolvedCockpitExtension;

describe('hosted external route components', () => {
  it('builds hosted route components only from the compile-time installed module catalog', () => {
    expect(Object.keys(HOSTED_EXTERNAL_ROUTE_COMPONENTS).sort()).toEqual(
      Object.keys(INSTALLED_COCKPIT_ROUTE_LOADERS).sort(),
    );
    expect(HOSTED_EXTERNAL_ROUTE_COMPONENTS).not.toHaveProperty('remote-extension-route');
  });

  it('renders data-only route modules through the generic host renderer', async () => {
    const Component = createHostedExternalRouteComponent({
      loader: async () => ({
        title: 'Data Backed Overview',
        status: 'placeholder',
        message: 'Loaded from a host-owned route data loader.',
        safety: {
          sourceSystemAccess: 'none',
          includesRawSourcePayloads: false,
        },
        emptyState: {
          heading: 'Data route connected',
          body: 'The route module returned structured placeholder data.',
          nextStep: 'Replace the placeholder with a governed host data query.',
        },
        sections: [
          {
            id: 'rooms',
            title: 'Rooms',
            summary: 'Room context is available as redacted route data.',
            classification: 'internal',
          },
        ],
        actions: [
          {
            id: 'open-map',
            label: 'Open map',
            disabled: true,
            reason: 'Map actions are not enabled for the placeholder.',
          },
        ],
        data: {
          rooms: [{ id: 'room-1' }],
          freshnessSummary: { fresh: 1 },
        },
      }),
    });

    render(<Component route={route} extension={resolvedExtension} params={{}} />);

    expect(await screen.findByRole('heading', { name: 'Data Backed Overview' })).toBeTruthy();
    expect(screen.getByText('Safety Contract')).toBeTruthy();
    expect(screen.getByText('Rooms')).toBeTruthy();
    expect(screen.getByText('Open map')).toBeTruthy();
    expect(screen.getByText('rooms: 1')).toBeTruthy();
  });

  it('prefers a custom route renderer when the module also exports a data loader', async () => {
    const loader = vi.fn();
    const Component = createHostedExternalRouteComponent({
      default: ({ params, searchParams }) => (
        <div>
          <h1>Custom Map Workbench</h1>
          <p>{`room=${params.roomId ?? 'none'}`}</p>
          <p>{`tab=${searchParams?.tab ?? 'summary'}`}</p>
        </div>
      ),
      loader,
    });

    render(
      <Component
        route={route}
        extension={resolvedExtension}
        params={{ roomId: 'g6' }}
        searchParams={{ tab: 'evidence' }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Custom Map Workbench' })).toBeTruthy();
    expect(screen.getByText('room=g6')).toBeTruthy();
    expect(screen.getByText('tab=evidence')).toBeTruthy();
    expect(loader).not.toHaveBeenCalled();
  });

  it('uses the host-native data renderer when a module opts out of custom route UI', async () => {
    const loader = vi.fn(async () => ({
      nativeSurface: {
        kind: 'portarium.native.ticketInbox.v1',
        title: 'Native Ticket Queue',
        description: 'Rendered by Cockpit primitives.',
        badges: [{ label: 'Read only' }],
        queue: {
          views: [{ id: 'open', label: 'Open', count: 1, href: '/external/native/tickets', active: true }],
          filters: [],
          search: {
            action: '/external/native/tickets',
            sort: 'queue',
            pageSize: 25,
            sortOptions: [{ value: 'queue', label: 'Queue order' }],
            pageSizeOptions: [25],
          },
          statusText: '1 ticket in this view from 1 row.',
          pageText: 'Page 1 of 1',
          tickets: [
            {
              id: 'fs-1',
              label: 'FS 1',
              summary: 'Incident snapshot',
              href: '/external/native/tickets?ticket=1#ticket-reader',
              selected: true,
              statusLabel: 'Open',
              lifecycle: 'open',
              priorityLabel: 'Low',
              updatedAtLabel: 'Updated today',
              sourceRef: 'freshservice-snapshot/1',
            },
          ],
          pagination: [],
        },
        selectedTicket: {
          label: 'FS 1',
          sourceRef: 'freshservice-snapshot/1',
          summary: 'Incident snapshot',
          badges: [{ label: 'open', tone: 'info' }],
          conversation: {
            title: 'Conversation unavailable',
            message: 'Redacted snapshot only.',
          },
          properties: [{ label: 'Status', value: 'Open' }],
          relatedContext: { items: [] },
          diagnostics: [{ label: 'Source mode', value: 'unofficial_csv_snapshot' }],
        },
      },
    }));
    const Component = createHostedExternalRouteComponent({
      hostRendering: { mode: 'host-native' },
      default: () => <h1>Custom renderer should not show</h1>,
      loader,
    });

    render(
      <Component
        route={route}
        extension={resolvedExtension}
        params={{}}
        pathname="/external/native/tickets"
        searchParams={{ ticket: '1' }}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Native Ticket Queue' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Custom renderer should not show' })).toBeNull();
    expect(screen.getByText('Selected Ticket')).toBeTruthy();
    expect(loader).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/external/native/tickets',
        searchParams: { ticket: '1' },
      }),
    );
  });
});
