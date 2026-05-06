// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

afterEach(() => cleanup());

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
          views: [
            { id: 'open', label: 'Open', count: 1, href: '/external/native/tickets', active: true },
          ],
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
              sourceRef: 'service-desk-snapshot/1',
            },
          ],
          pagination: [],
        },
        selectedTicket: {
          label: 'FS 1',
          sourceRef: 'service-desk-snapshot/1',
          summary: 'Incident snapshot',
          activeSection: 'evidence',
          sections: [
            {
              id: 'conversation',
              label: 'Conversation',
              href: '/external/native/tickets?ticket=1&tab=conversation#ticket-reader',
            },
            {
              id: 'evidence',
              label: 'Evidence',
              href: '/external/native/tickets?ticket=1&tab=evidence#ticket-reader',
              active: true,
            },
          ],
          badges: [{ label: 'open', tone: 'info' }],
          conversation: {
            title: 'Conversation unavailable',
            message: 'Redacted snapshot only.',
          },
          sectionContent: {
            kind: 'evidence',
            title: 'Read-only evidence',
            items: [
              {
                id: 'evidence-1',
                label: 'Room signal',
                summary: 'Redacted room context matched this ticket.',
              },
            ],
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
    expect(screen.getByRole('link', { name: 'Conversation' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Evidence' })).toBeTruthy();
    expect(screen.getByText('Read-only evidence')).toBeTruthy();
    expect(screen.getByText('Room signal')).toBeTruthy();
    expect(loader).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/external/native/tickets',
        searchParams: { ticket: '1' },
      }),
    );
  });

  it('renders host-native data explorer surfaces from route loader descriptors', async () => {
    const Component = createHostedExternalRouteComponent({
      hostRendering: { mode: 'host-native' },
      loader: async () => ({
        nativeSurface: {
          kind: 'portarium.native.dataExplorer.v1',
          title: 'Native Data Explorer',
          description: 'Read-only data source landscape.',
          badges: [{ label: 'Read only' }, { label: 'Snapshot data' }],
          explorer: {
            metrics: [
              {
                id: 'sources',
                label: 'Sources',
                value: '2',
                detail: 'Static source projections',
                tone: 'info',
              },
            ],
            sourcePosture: {
              generatedAt: '2026-05-06T00:00:00.000Z',
              sourceSystemAccess: 'none',
              dataOrigin: 'static-redacted-read-model',
              sourceCount: 2,
              readOnlySourceCount: 2,
              localSnapshotCount: 1,
              restrictedOrSensitiveCount: 1,
              staleOrUnknownCount: 0,
            },
            snapshotPorts: [
              {
                id: 'service-desk',
                label: 'Service desk mock',
                sourceSystem: 'service_desk',
                state: 'ready',
                sourceSystemAccess: 'none',
                writebackEnabled: false,
                rawPayloadsIncluded: false,
                credentialsIncluded: false,
                capabilityIds: ['service-desk.ticket.snapshot.read'],
                mockDataPlane: 'Local redacted ticket snapshot.',
                livePromotionGate: 'Governed read-only adapter review.',
              },
            ],
            sources: [
              {
                id: 'service-desk',
                label: 'Service desk snapshot',
                sourceSystem: 'service_desk',
                sourceMode: 'unofficial_csv_snapshot',
                category: 'Tickets',
                readiness: 'static snapshot',
                freshness: 'fresh',
                privacyClass: 'restricted',
                itemCount: 25,
                recordCount: 743,
                summary: 'Redacted ticket rows are available as operator context.',
                sourceRefs: ['fixtures/service-desk-tickets.redacted.json'],
                capabilityIds: ['service-desk.ticket.snapshot.read'],
                connectorIds: ['example.service-desk.snapshot'],
                visualisations: ['ticket queue', 'room heatmap'],
                answerableQuestions: ['Which rooms have ticket clusters?'],
                portariumSurfaces: ['Data', 'Ticket Queue'],
              },
            ],
            insights: [
              {
                id: 'room-clusters',
                title: 'Room ticket clusters',
                summary: 'Join room hints to map features to find noisy spaces.',
                tone: 'warning',
                sourceIds: ['service-desk'],
              },
            ],
            integrationNotes: ['The host renders the UI; the extension supplies descriptors only.'],
          },
        },
      }),
    });

    render(
      <Component
        route={route}
        extension={resolvedExtension}
        params={{}}
        pathname="/external/native/data"
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Native Data Explorer' })).toBeTruthy();
    expect(screen.getByLabelText('Operational snapshot')).toBeTruthy();
    expect(screen.getByText('Source Posture')).toBeTruthy();
    expect(screen.getByLabelText('Snapshot mock ports')).toBeTruthy();
    expect(screen.getByText('Service desk mock')).toBeTruthy();
    expect(screen.getByText('Local redacted ticket snapshot.')).toBeTruthy();
    expect(screen.getByText('Recommended Checks')).toBeTruthy();
    expect(screen.getByText('Read-Only Data Sources')).toBeTruthy();
    expect(screen.getByText('Available Static Data')).toBeTruthy();
    expect(screen.getByText('Service desk snapshot')).toBeTruthy();
    expect(screen.getAllByText('743')).not.toHaveLength(0);
    expect(screen.getByText('Technical evidence and routing')).toBeTruthy();
    expect(screen.getByText('fixtures/service-desk-tickets.redacted.json')).toBeTruthy();
    expect(screen.getAllByText('service-desk.ticket.snapshot.read')).not.toHaveLength(0);
    expect(screen.getByText('example.service-desk.snapshot')).toBeTruthy();
    expect(screen.getByText('Room ticket clusters')).toBeTruthy();
    expect(screen.getByText('Portarium Integration Boundary')).toBeTruthy();
  });

  it('renders host-native map workbench surfaces inside shared extension chrome', async () => {
    const Component = createHostedExternalRouteComponent({
      hostRendering: { mode: 'host-native' },
      loader: async () => ({
        nativeSurface: {
          kind: 'portarium.native.mapWorkbench.v1',
          title: 'Campus Map',
          description: 'Read-only provider and custom map context.',
          badges: [{ label: 'Read only' }, { label: 'Map host' }],
          area: {
            label: 'Example Workspace',
            title: 'Operations',
            navItems: [
              { id: 'queue', label: 'Ticket Queue', href: '/external/native/tickets' },
              { id: 'map', label: 'Campus Map', href: '/external/native/map', active: true },
            ],
            boundary: ['Read-only snapshot'],
          },
          map: {
            mode: 'hybrid',
            activeBaseMapId: 'custom',
            baseMaps: [
              {
                id: 'provider',
                label: 'Provider map',
                kind: 'provider',
                provider: 'leaflet-compatible',
              },
              { id: 'custom', label: 'Indoor map', kind: 'custom' },
            ],
            layers: [
              {
                id: 'rooms',
                label: 'Rooms',
                enabled: true,
                kind: 'room',
                freshnessLabel: 'Snapshot',
              },
            ],
            entities: [
              {
                id: 'room-1',
                label: 'Room 1',
                kind: 'room',
                status: 'normal',
                locationLabel: 'L1',
                sourceRef: 'map/room-1',
              },
            ],
            selectionLabel: 'Room 1',
            tabs: [
              { id: 'summary', label: 'Summary', count: 1 },
              { id: 'evidence', label: 'Evidence', count: 1 },
            ],
            activeTab: 'summary',
            readOnlyGroups: [
              {
                id: 'context',
                label: 'Read-only context',
                description: 'Evidence for selected room.',
                items: [{ id: 'item-1', label: 'Ticket ref', summary: 'Redacted ticket ref.' }],
              },
            ],
          },
        },
      }),
    });

    render(
      <Component
        route={route}
        extension={resolvedExtension}
        params={{}}
        pathname="/external/native/map"
      />,
    );

    expect(await screen.findAllByText('Campus Map')).not.toHaveLength(0);
    expect(screen.getByText('Operations')).toBeTruthy();
    expect(screen.getAllByText('Ticket Queue')).not.toHaveLength(0);
    expect(screen.getAllByText('Provider map')).not.toHaveLength(0);
    expect(screen.getAllByText('Indoor map')).not.toHaveLength(0);
    expect(screen.getAllByText('Read-only context')).not.toHaveLength(0);
    expect(screen.getAllByText('Room 1')).not.toHaveLength(0);
  });
});
