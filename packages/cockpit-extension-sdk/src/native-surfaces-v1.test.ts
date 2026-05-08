import { describe, expect, it } from 'vitest';
import {
  COCKPIT_NATIVE_ROUTE_SURFACE_KINDS,
  defineCockpitNativeRouteSurface,
  defineCockpitNativeRouteSurfaceData,
  hasCockpitNativeRouteSurface,
  isCockpitNativeRouteSurface,
  type CockpitNativeDataExplorerSurface,
  type CockpitNativeGovernedActionReviewSurface,
  type CockpitNativeMapWorkbenchSurface,
  type CockpitNativeTicketInboxSurface,
} from './index.js';

describe('native route surface descriptors', () => {
  it('exports the current host-native surface kinds as the SDK contract', () => {
    expect(COCKPIT_NATIVE_ROUTE_SURFACE_KINDS).toEqual([
      'portarium.native.dataExplorer.v1',
      'portarium.native.ticketInbox.v1',
      'portarium.native.mapWorkbench.v1',
      'portarium.native.governedActionReview.v1',
    ]);
  });

  it('builds and detects ticket inbox descriptors', () => {
    const surface = defineCockpitNativeRouteSurface({
      kind: 'portarium.native.ticketInbox.v1',
      title: 'Tickets',
      queue: {
        views: [{ id: 'open', label: 'Open', count: 1, href: '/external/tickets', active: true }],
        filters: [{ label: 'Priority', options: [{ label: 'High', href: '/external/tickets' }] }],
        search: {
          action: '/external/tickets',
          sort: 'updated',
          pageSize: 25,
          sortOptions: [{ value: 'updated', label: 'Updated' }],
          pageSizeOptions: [25, 50],
        },
        statusText: '1 ticket',
        pageText: 'Page 1',
        tickets: [
          {
            id: 'ticket-1',
            label: 'ICT-1',
            summary: 'Example ticket',
            href: '/external/tickets/1',
            statusLabel: 'Open',
            priorityLabel: 'High',
            updatedAtLabel: 'Now',
            sourceRef: 'zammad:ticket:1',
          },
        ],
        pagination: [{ label: 'Next', href: '/external/tickets?page=2' }],
      },
    } satisfies CockpitNativeTicketInboxSurface);

    expect(surface.kind).toBe('portarium.native.ticketInbox.v1');
    expect(hasCockpitNativeRouteSurface(defineCockpitNativeRouteSurfaceData(surface))).toBe(true);
    expect(isCockpitNativeRouteSurface(surface)).toBe(true);
  });

  it('builds data explorer and map workbench descriptors', () => {
    const dataExplorer = defineCockpitNativeRouteSurface({
      kind: 'portarium.native.dataExplorer.v1',
      title: 'Data',
      explorer: {
        metrics: [{ id: 'sources', label: 'Sources', value: '1' }],
        sources: [
          {
            id: 'source-1',
            label: 'Source',
            sourceSystem: 'erp',
            sourceMode: 'snapshot',
            summary: 'Read-only source descriptor',
          },
        ],
        observability: [
          {
            id: 'coverage',
            title: 'Coverage',
            summary: 'Snapshot coverage is available.',
            metrics: [{ label: 'Rows', value: '1' }],
          },
        ],
        insights: [{ id: 'insight-1', title: 'Ready', summary: 'Descriptor accepted.' }],
      },
    } satisfies CockpitNativeDataExplorerSurface);

    const mapWorkbench = defineCockpitNativeRouteSurface({
      kind: 'portarium.native.mapWorkbench.v1',
      title: 'Map',
      map: {
        mode: 'custom',
        activeBaseMapId: 'campus',
        baseMaps: [{ id: 'campus', label: 'Campus', kind: 'custom' }],
        layers: [{ id: 'rooms', label: 'Rooms', enabled: true, kind: 'room' }],
        entities: [{ id: 'room-1', label: 'Room 1', kind: 'room' }],
        tabs: [{ id: 'layers', label: 'Layers', count: 1 }],
        activeTab: 'layers',
        readOnlyGroups: [{ id: 'evidence', label: 'Evidence', items: [] }],
      },
    } satisfies CockpitNativeMapWorkbenchSurface);

    expect(isCockpitNativeRouteSurface(dataExplorer)).toBe(true);
    expect(isCockpitNativeRouteSurface(mapWorkbench)).toBe(true);
  });

  it('builds governed action review descriptors', () => {
    const review = defineCockpitNativeRouteSurface({
      kind: 'portarium.native.governedActionReview.v1',
      title: 'Governed Action Review',
      proposal: {
        reference: 'proposal-1',
        reviewMode: 'read-only',
        approvalState: 'not-loaded',
        executionDisabled: true,
        reviewOnly: true,
        minimumExecutionTier: 'manual-only',
        rationale: 'Review-only descriptor.',
      },
      evidence: {
        referencedEvidenceCount: 1,
        sourceBodiesIncluded: false,
        refs: [
          {
            id: 'evidence-1',
            summary: 'Redacted evidence reference',
            sourceSystem: 'ticketing',
            sourceMode: 'snapshot',
            sourceRef: 'ticket:1',
          },
        ],
      },
      actions: [{ id: 'review', label: 'Review', disabled: true }],
      execution: {
        available: false,
        adapterInstalled: false,
        writebackEnabled: false,
        sourceSystemAccess: 'none',
      },
    } satisfies CockpitNativeGovernedActionReviewSurface);

    expect(isCockpitNativeRouteSurface(review)).toBe(true);
  });

  it('keeps runtime detection narrow to registered surface kinds', () => {
    expect(isCockpitNativeRouteSurface({ kind: 'portarium.native.unknown.v1' })).toBe(false);
    expect(isCockpitNativeRouteSurface([{ kind: 'portarium.native.ticketInbox.v1' }])).toBe(false);
    expect(hasCockpitNativeRouteSurface({ nativeSurface: { title: 'Missing kind' } })).toBe(false);
  });
});
