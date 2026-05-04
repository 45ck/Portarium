// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
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
});
