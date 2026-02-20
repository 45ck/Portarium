import { describe, expect, it } from 'vitest';

import { parseLocationEventV1 } from '../../domain/location/location-event-v1.js';
import {
  InMemoryLocationHistoryStore,
  InMemoryLocationLatestStateCache,
} from './localisation-ingestion-pipeline.js';
import {
  DEFAULT_MAP_DATA_LATENCY_BUDGET,
  InMemoryLocationMapLayerStore,
  MapDataServices,
  parseAndStoreMapLayer,
} from './map-data-services.js';

function locationEvent(overrides?: Record<string, unknown>) {
  return parseLocationEventV1({
    schemaVersion: 1,
    locationEventId: 'evt-1',
    tenantId: 'workspace-1',
    assetId: 'asset-1',
    robotId: 'robot-1',
    sourceStreamId: 'stream-1',
    sourceType: 'SLAM',
    coordinateFrame: 'floor-1',
    observedAtIso: '2026-02-20T10:00:00.000Z',
    ingestedAtIso: '2026-02-20T10:00:00.100Z',
    pose: { x: 1, y: 2, z: 0, yawRadians: 0.5 },
    quality: { status: 'Known', horizontalStdDevMeters: 0.2 },
    correlationId: 'corr-1',
    ...overrides,
  });
}

describe('MapDataServices', () => {
  it('returns latest pose per tenant and asset', async () => {
    const latestStateCache = new InMemoryLocationLatestStateCache();
    const historyStore = new InMemoryLocationHistoryStore();
    const mapLayerStore = new InMemoryLocationMapLayerStore();
    const services = new MapDataServices({ latestStateCache, historyStore, mapLayerStore });

    await latestStateCache.put(
      locationEvent({
        locationEventId: 'evt-latest-1',
        tenantId: 'workspace-1',
        assetId: 'asset-1',
      }),
    );
    await latestStateCache.put(
      locationEvent({
        locationEventId: 'evt-latest-2',
        tenantId: 'workspace-2',
        assetId: 'asset-1',
      }),
    );

    const latest = await services.getLatestPose('workspace-1', 'asset-1');
    expect(latest).not.toBeNull();
    expect(latest?.locationEventId).toBe('evt-latest-1');
    expect(services.latencyBudget).toEqual(DEFAULT_MAP_DATA_LATENCY_BUDGET);
  });

  it('queries history by time window, asset, source type, and site/floor mapping', async () => {
    const latestStateCache = new InMemoryLocationLatestStateCache();
    const historyStore = new InMemoryLocationHistoryStore();
    const mapLayerStore = new InMemoryLocationMapLayerStore();
    const services = new MapDataServices({ latestStateCache, historyStore, mapLayerStore });

    await parseAndStoreMapLayer(mapLayerStore, {
      schemaVersion: 1,
      mapLayerId: 'ml-floor-1',
      tenantId: 'workspace-1',
      siteId: 'site-a',
      floorId: 'floor-1',
      layerType: 'Floorplan',
      coordinateFrame: 'floor-1',
      origin: { x: 0, y: 0, z: 0 },
      version: 1,
      validFromIso: '2026-02-20T00:00:00.000Z',
      provenance: {
        sourceType: 'CadImport',
        sourceRef: 'floorplan-v1',
        registeredAtIso: '2026-02-20T00:00:00.000Z',
        registeredBy: 'ops-admin',
      },
    });

    await historyStore.append(
      locationEvent({
        locationEventId: 'evt-a',
        sourceStreamId: 'stream-1',
        sourceType: 'SLAM',
        observedAtIso: '2026-02-20T10:01:00.000Z',
        ingestedAtIso: '2026-02-20T10:01:00.100Z',
        coordinateFrame: 'floor-1',
      }),
    );
    await historyStore.append(
      locationEvent({
        locationEventId: 'evt-b',
        sourceStreamId: 'stream-2',
        sourceType: 'RTLS',
        observedAtIso: '2026-02-20T10:02:00.000Z',
        ingestedAtIso: '2026-02-20T10:02:00.100Z',
        coordinateFrame: 'floor-1',
      }),
    );
    await historyStore.append(
      locationEvent({
        locationEventId: 'evt-c',
        tenantId: 'workspace-2',
        sourceStreamId: 'stream-3',
        sourceType: 'SLAM',
        observedAtIso: '2026-02-20T10:03:00.000Z',
        ingestedAtIso: '2026-02-20T10:03:00.100Z',
      }),
    );
    await historyStore.append(
      locationEvent({
        locationEventId: 'evt-d',
        sourceStreamId: 'stream-4',
        sourceType: 'SLAM',
        observedAtIso: '2026-02-20T11:00:00.000Z',
        ingestedAtIso: '2026-02-20T11:00:00.100Z',
      }),
    );

    const results = await services.queryHistory({
      tenantId: 'workspace-1',
      fromIso: '2026-02-20T10:00:00.000Z',
      toIso: '2026-02-20T10:59:59.999Z',
      siteId: 'site-a',
      floorId: 'floor-1',
      sourceType: 'SLAM',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.locationEventId).toBe('evt-a');
  });

  it('retrieves map layers by version with tenant isolation', async () => {
    const mapLayerStore = new InMemoryLocationMapLayerStore();
    const services = new MapDataServices({
      latestStateCache: new InMemoryLocationLatestStateCache(),
      historyStore: new InMemoryLocationHistoryStore(),
      mapLayerStore,
    });

    await parseAndStoreMapLayer(mapLayerStore, {
      schemaVersion: 1,
      mapLayerId: 'ml-floor-1',
      tenantId: 'workspace-1',
      siteId: 'site-a',
      floorId: 'floor-1',
      layerType: 'Floorplan',
      coordinateFrame: 'floor-1',
      origin: { x: 0, y: 0, z: 0 },
      version: 1,
      validFromIso: '2026-02-20T00:00:00.000Z',
      provenance: {
        sourceType: 'CadImport',
        sourceRef: 'floorplan-v1',
        registeredAtIso: '2026-02-20T00:00:00.000Z',
        registeredBy: 'ops-admin',
      },
    });
    await parseAndStoreMapLayer(mapLayerStore, {
      schemaVersion: 1,
      mapLayerId: 'ml-floor-1',
      tenantId: 'workspace-1',
      siteId: 'site-a',
      floorId: 'floor-1',
      layerType: 'Floorplan',
      coordinateFrame: 'floor-1',
      origin: { x: 0, y: 0, z: 0 },
      version: 2,
      validFromIso: '2026-02-21T00:00:00.000Z',
      provenance: {
        sourceType: 'CadImport',
        sourceRef: 'floorplan-v2',
        registeredAtIso: '2026-02-21T00:00:00.000Z',
        registeredBy: 'ops-admin',
      },
    });
    await parseAndStoreMapLayer(mapLayerStore, {
      schemaVersion: 1,
      mapLayerId: 'ml-floor-1',
      tenantId: 'workspace-2',
      siteId: 'site-a',
      floorId: 'floor-1',
      layerType: 'Floorplan',
      coordinateFrame: 'floor-1',
      origin: { x: 0, y: 0, z: 0 },
      version: 1,
      validFromIso: '2026-02-20T00:00:00.000Z',
      provenance: {
        sourceType: 'CadImport',
        sourceRef: 'floorplan-v1',
        registeredAtIso: '2026-02-20T00:00:00.000Z',
        registeredBy: 'ops-admin',
      },
    });

    const workspace1v2 = await services.listMapLayers({
      tenantId: 'workspace-1',
      version: 2,
    });
    expect(workspace1v2).toHaveLength(1);
    expect(workspace1v2[0]?.version).toBe(2);

    const workspace2 = await services.listMapLayers({
      tenantId: 'workspace-2',
      version: 1,
    });
    expect(workspace2).toHaveLength(1);
    expect(String(workspace2[0]?.tenantId)).toBe('workspace-2');
  });
});
