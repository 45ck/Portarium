import type { LocationEventV1 } from '../../domain/location/location-event-v1.js';
import {
  parseMapLayerV1,
  type MapLayerV1,
  type MapLayerType,
} from '../../domain/location/map-layer-v1.js';
import type {
  LocationHistoryStore,
  LocationLatestStateCache,
} from './localisation-ingestion-pipeline.js';

export interface LocationMapLayerStore {
  put(layer: MapLayerV1): Promise<void>;
  list(tenantId: string): Promise<readonly MapLayerV1[]>;
}

export type LocationHistoryQuery = Readonly<{
  tenantId: string;
  fromIso: string;
  toIso: string;
  assetId?: string;
  siteId?: string;
  floorId?: string;
  sourceType?: LocationEventV1['sourceType'];
  limit?: number;
}>;

export type MapLayerQuery = Readonly<{
  tenantId: string;
  siteId?: string;
  floorId?: string;
  layerType?: MapLayerType;
  version?: number;
}>;

export type MapDataLatencyBudget = Readonly<{
  latestPoseP95Ms: number;
  historyWindowP95Ms: number;
}>;

export const DEFAULT_MAP_DATA_LATENCY_BUDGET: MapDataLatencyBudget = {
  latestPoseP95Ms: 50,
  historyWindowP95Ms: 250,
};

export class MapDataServices {
  readonly #latestStateCache: LocationLatestStateCache;
  readonly #historyStore: LocationHistoryStore;
  readonly #mapLayerStore: LocationMapLayerStore;
  readonly #latencyBudget: MapDataLatencyBudget;

  public constructor(deps: {
    latestStateCache: LocationLatestStateCache;
    historyStore: LocationHistoryStore;
    mapLayerStore: LocationMapLayerStore;
    latencyBudget?: MapDataLatencyBudget;
  }) {
    this.#latestStateCache = deps.latestStateCache;
    this.#historyStore = deps.historyStore;
    this.#mapLayerStore = deps.mapLayerStore;
    this.#latencyBudget = deps.latencyBudget ?? DEFAULT_MAP_DATA_LATENCY_BUDGET;
  }

  public get latencyBudget(): MapDataLatencyBudget {
    return this.#latencyBudget;
  }

  public async getLatestPose(tenantId: string, assetId: string): Promise<LocationEventV1 | null> {
    return this.#latestStateCache.get(tenantId, assetId);
  }

  public async queryHistory(query: LocationHistoryQuery): Promise<readonly LocationEventV1[]> {
    assertValidWindow(query.fromIso, query.toIso);
    const tenantEvents = await this.#historyStore.listByTenant(query.tenantId);
    const mappedFrames = await this.#framesForFilters(query);
    const limited = normalizeLimit(query.limit);

    return tenantEvents
      .filter((event) => eventMatchesQuery(event, query, mappedFrames))
      .sort(compareByObservedAt)
      .slice(0, limited);
  }

  public async listMapLayers(query: MapLayerQuery): Promise<readonly MapLayerV1[]> {
    const all = await this.#mapLayerStore.list(query.tenantId);
    return all.filter((layer) => mapLayerMatchesQuery(layer, query)).sort(compareLayers);
  }

  async #framesForFilters(query: LocationHistoryQuery): Promise<ReadonlySet<string> | null> {
    if (!query.siteId && !query.floorId) {
      return null;
    }

    const layers = await this.#mapLayerStore.list(query.tenantId);
    const frames = new Set<string>();
    for (const layer of layers) {
      if (query.siteId && String(layer.siteId) !== query.siteId) {
        continue;
      }
      if (query.floorId && String(layer.floorId) !== query.floorId) {
        continue;
      }
      frames.add(layer.coordinateFrame);
    }
    return frames;
  }
}

function eventMatchesQuery(
  event: LocationEventV1,
  query: LocationHistoryQuery,
  mappedFrames: ReadonlySet<string> | null,
): boolean {
  if (String(event.tenantId) !== query.tenantId) {
    return false;
  }
  if (query.assetId && String(event.assetId) !== query.assetId) {
    return false;
  }
  if (query.sourceType && event.sourceType !== query.sourceType) {
    return false;
  }
  if (mappedFrames && !mappedFrames.has(event.coordinateFrame)) {
    return false;
  }
  const observedAt = Date.parse(event.observedAtIso);
  const from = Date.parse(query.fromIso);
  const to = Date.parse(query.toIso);
  return observedAt >= from && observedAt <= to;
}

function mapLayerMatchesQuery(layer: MapLayerV1, query: MapLayerQuery): boolean {
  if (String(layer.tenantId) !== query.tenantId) {
    return false;
  }
  if (query.siteId && String(layer.siteId) !== query.siteId) {
    return false;
  }
  if (query.floorId && String(layer.floorId) !== query.floorId) {
    return false;
  }
  if (query.layerType && layer.layerType !== query.layerType) {
    return false;
  }
  if (query.version && layer.version !== query.version) {
    return false;
  }
  return true;
}

function compareByObservedAt(left: LocationEventV1, right: LocationEventV1): number {
  const observedDiff = Date.parse(left.observedAtIso) - Date.parse(right.observedAtIso);
  if (observedDiff !== 0) {
    return observedDiff;
  }
  return Date.parse(left.ingestedAtIso) - Date.parse(right.ingestedAtIso);
}

function compareLayers(left: MapLayerV1, right: MapLayerV1): number {
  if (left.version !== right.version) {
    return left.version - right.version;
  }
  return Date.parse(left.validFromIso) - Date.parse(right.validFromIso);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 500;
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer when provided.');
  }
  return Math.min(limit, 5_000);
}

function assertValidWindow(fromIso: string, toIso: string): void {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new Error('fromIso and toIso must be valid ISO timestamps.');
  }
  if (from > to) {
    throw new Error('fromIso must be before or equal to toIso.');
  }
}

function keyOf(tenantId: string, mapLayerId: string, version: number): string {
  return `${tenantId}/${mapLayerId}/${version}`;
}

export class InMemoryLocationMapLayerStore implements LocationMapLayerStore {
  readonly #layers = new Map<string, MapLayerV1>();

  public put(layer: MapLayerV1): Promise<void> {
    this.#layers.set(keyOf(String(layer.tenantId), String(layer.mapLayerId), layer.version), layer);
    return Promise.resolve();
  }

  public list(tenantId: string): Promise<readonly MapLayerV1[]> {
    return Promise.resolve(
      [...this.#layers.values()].filter((layer) => String(layer.tenantId) === tenantId),
    );
  }
}

export function parseAndStoreMapLayer(
  store: LocationMapLayerStore,
  raw: unknown,
): Promise<MapLayerV1> {
  const parsed = parseMapLayerV1(raw);
  return store.put(parsed).then(() => parsed);
}
