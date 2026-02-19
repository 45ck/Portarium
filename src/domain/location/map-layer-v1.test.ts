import { describe, expect, it } from 'vitest';

import { parseMapLayerV1 } from './map-layer-v1.js';

function baseLayer(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 1,
    mapLayerId: 'layer-1',
    tenantId: 'ws-1',
    siteId: 'site-1',
    floorId: 'floor-1',
    layerType: 'Floorplan',
    coordinateFrame: 'map',
    origin: {
      x: 0,
      y: 0,
      z: 0,
    },
    version: 3,
    validFromIso: '2026-02-19T10:00:00.000Z',
    provenance: {
      sourceType: 'CadImport',
      sourceRef: 'cad://facility-a/floor-1',
      registeredAtIso: '2026-02-19T10:00:00.000Z',
      registeredBy: 'planner-1',
    },
    ...overrides,
  };
}

describe('parseMapLayerV1', () => {
  it('parses a valid floorplan layer', () => {
    const parsed = parseMapLayerV1(baseLayer());
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.layerType).toBe('Floorplan');
  });

  it('requires resolution for OccupancyGrid layers', () => {
    expect(() =>
      parseMapLayerV1(
        baseLayer({
          layerType: 'OccupancyGrid',
        }),
      ),
    ).toThrow(/resolutionMetersPerCell/i);
  });

  it('requires boundToMapVersion for geofence layers', () => {
    expect(() =>
      parseMapLayerV1(
        baseLayer({
          layerType: 'Geofence',
        }),
      ),
    ).toThrow(/boundToMapVersion/i);
  });

  it('accepts semantic zone layers when boundToMapVersion is provided', () => {
    const parsed = parseMapLayerV1(
      baseLayer({
        layerType: 'SemanticZone',
        boundToMapVersion: 7,
      }),
    );
    expect(parsed.boundToMapVersion).toBe(7);
  });

  it('rejects validToIso before validFromIso', () => {
    expect(() =>
      parseMapLayerV1(
        baseLayer({
          validFromIso: '2026-02-19T10:00:00.000Z',
          validToIso: '2026-02-19T09:59:59.000Z',
        }),
      ),
    ).toThrow(/validToIso/i);
  });

  it('rejects non-positive resolution values', () => {
    expect(() =>
      parseMapLayerV1(
        baseLayer({
          layerType: 'OccupancyGrid',
          resolutionMetersPerCell: 0,
        }),
      ),
    ).toThrow(/positive finite number/i);
  });
});
