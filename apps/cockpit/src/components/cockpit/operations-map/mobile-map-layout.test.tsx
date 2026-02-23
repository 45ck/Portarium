// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

// Mock Leaflet before importing components that use it
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Circle: () => <div data-testid="circle" />,
  Polygon: () => <div data-testid="polygon" />,
  Polyline: () => <div data-testid="polyline" />,
  useMap: () => ({
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    getZoom: () => 13,
  }),
}));

vi.mock('leaflet', () => {
  class MockControl {
    addTo() {
      return this;
    }
    remove() {
      return this;
    }
  }
  return {
    default: {
      divIcon: () => ({}),
      latLngBounds: () => ({}),
      DomUtil: { create: () => document.createElement('div') },
      Control: { extend: () => MockControl },
      Icon: {
        Default: {
          prototype: {},
          mergeOptions: vi.fn(),
        },
      },
    },
  };
});

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => (
    <a href={props.to}>{children}</a>
  ),
}));

import type { RobotLocation, Geofence, SpatialAlert } from '@/mocks/fixtures/robot-locations';
import { MobileMapLayout } from './mobile-map-layout';

const mockLocations: RobotLocation[] = [
  {
    robotId: 'r-1',
    name: 'Alpha Bot',
    robotClass: 'AMR',
    status: 'Online',
    batteryPct: 85,
    lat: 47.6062,
    lng: -122.3321,
    heading: 0,
    speedMps: 1.2,
    updatedAtIso: '2026-02-23T10:00:00Z',
    missionId: 'MSN-001',
    trail: [],
  },
  {
    robotId: 'r-2',
    name: 'Beta Drone',
    robotClass: 'UAV',
    status: 'Degraded',
    batteryPct: 12,
    lat: 47.607,
    lng: -122.335,
    heading: 90,
    speedMps: 0,
    updatedAtIso: '2026-02-23T09:55:00Z',
    trail: [],
  },
];

const mockGeofences: Geofence[] = [
  {
    geofenceId: 'gf-1',
    label: 'Loading Dock',
    polygon: [
      [47.605, -122.33],
      [47.606, -122.33],
      [47.606, -122.34],
    ],
    color: '#3b82f6',
  },
];

const mockAlerts: SpatialAlert[] = [
  {
    alertId: 'alert-1',
    robotId: 'r-2',
    type: 'localization-drop',
    severity: 'critical',
    message: 'Beta Drone lost localization',
    timestampIso: '2026-02-23T09:56:00Z',
  },
  {
    alertId: 'alert-2',
    robotId: 'r-1',
    type: 'geofence-violation',
    severity: 'warning',
    message: 'Alpha Bot exited Loading Dock',
    timestampIso: '2026-02-23T09:58:00Z',
  },
];

describe('MobileMapLayout', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the map container', () => {
    render(
      <MobileMapLayout
        locations={mockLocations}
        geofences={mockGeofences}
        alerts={mockAlerts}
        selectedRobotId={null}
        onSelectRobot={vi.fn()}
        layers={{ geofences: true, trails: false, halos: false }}
        onLayersChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('map-container')).toBeTruthy();
  });

  it('shows live indicator with robot count', () => {
    render(
      <MobileMapLayout
        locations={mockLocations}
        geofences={mockGeofences}
        alerts={[]}
        selectedRobotId={null}
        onSelectRobot={vi.fn()}
        layers={{ geofences: true, trails: false, halos: false }}
        onLayersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('2 robots')).toBeTruthy();
  });

  it('shows Fleet bottom sheet with robot count when no selection', () => {
    render(
      <MobileMapLayout
        locations={mockLocations}
        geofences={mockGeofences}
        alerts={[]}
        selectedRobotId={null}
        onSelectRobot={vi.fn()}
        layers={{ geofences: true, trails: false, halos: false }}
        onLayersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Fleet')).toBeTruthy();
    expect(screen.getByText('(2)')).toBeTruthy();
  });

  it('shows alerts inside bottom sheet when present', () => {
    render(
      <MobileMapLayout
        locations={mockLocations}
        geofences={mockGeofences}
        alerts={mockAlerts}
        selectedRobotId={null}
        onSelectRobot={vi.fn()}
        layers={{ geofences: true, trails: false, halos: false }}
        onLayersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Alerts (2)')).toBeTruthy();
    expect(screen.getByText('Beta Drone lost localization')).toBeTruthy();
  });

  it('shows robot detail bottom sheet when a robot is selected', () => {
    render(
      <MobileMapLayout
        locations={mockLocations}
        geofences={mockGeofences}
        alerts={mockAlerts}
        selectedRobotId="r-1"
        onSelectRobot={vi.fn()}
        layers={{ geofences: true, trails: false, halos: false }}
        onLayersChange={vi.fn()}
      />,
    );
    // Should show the robot's name (appears in both sheet title and detail panel)
    const matches = screen.getAllByText('Alpha Bot');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders layer toggle button with aria-label', () => {
    render(
      <MobileMapLayout
        locations={mockLocations}
        geofences={mockGeofences}
        alerts={[]}
        selectedRobotId={null}
        onSelectRobot={vi.fn()}
        layers={{ geofences: true, trails: false, halos: false }}
        onLayersChange={vi.fn()}
      />,
    );
    const toggleBtn = screen.getByLabelText('Toggle map layers');
    expect(toggleBtn).toBeTruthy();
  });

  it('opens mobile layer panel on toggle click', () => {
    render(
      <MobileMapLayout
        locations={mockLocations}
        geofences={mockGeofences}
        alerts={[]}
        selectedRobotId={null}
        onSelectRobot={vi.fn()}
        layers={{ geofences: true, trails: false, halos: false }}
        onLayersChange={vi.fn()}
      />,
    );
    const toggleBtn = screen.getByLabelText('Toggle map layers');
    fireEvent.click(toggleBtn);
    // The mobile layer panel renders text labels — there may be duplicates from
    // the MapView's own LayerToggles, so use getAllByText
    const trailItems = screen.getAllByText('Trails');
    expect(trailItems.length).toBeGreaterThanOrEqual(1);
    const zoneItems = screen.getAllByText('Uncertainty zones');
    expect(zoneItems.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onLayersChange when a mobile layer toggle is clicked', () => {
    const onLayersChange = vi.fn();
    render(
      <MobileMapLayout
        locations={mockLocations}
        geofences={mockGeofences}
        alerts={[]}
        selectedRobotId={null}
        onSelectRobot={vi.fn()}
        layers={{ geofences: true, trails: false, halos: false }}
        onLayersChange={onLayersChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Toggle map layers'));
    // Click the first "Trails" button we find — the mobile layer panel renders its own
    const trailButtons = screen.getAllByText('Trails');
    fireEvent.click(trailButtons[0]);
    expect(onLayersChange).toHaveBeenCalled();
  });

  it('calls onSelectRobot when an alert is clicked', () => {
    const onSelectRobot = vi.fn();
    render(
      <MobileMapLayout
        locations={mockLocations}
        geofences={mockGeofences}
        alerts={mockAlerts}
        selectedRobotId={null}
        onSelectRobot={onSelectRobot}
        layers={{ geofences: true, trails: false, halos: false }}
        onLayersChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Beta Drone lost localization'));
    expect(onSelectRobot).toHaveBeenCalledWith('r-2');
  });
});
