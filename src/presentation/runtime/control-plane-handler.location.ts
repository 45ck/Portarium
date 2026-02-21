/**
 * Location-events and map-layer HTTP handlers for the control-plane runtime.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AppContext } from '../../application/common/context.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import {
  InMemoryLocationHistoryStore,
  InMemoryLocationLatestStateCache,
} from '../../infrastructure/location/localisation-ingestion-pipeline.js';
import {
  InMemoryLocationMapLayerStore,
  MapDataServices,
  parseAndStoreMapLayer,
} from '../../infrastructure/location/map-data-services.js';
import { parseLocationEventV1 } from '../../domain/location/location-event-v1.js';
import { enforceLocationTelemetryBoundary } from './location-telemetry-boundary.js';
import {
  type ControlPlaneDeps,
  authenticate,
  assertReadAccess,
  paginate,
  problemFromError,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

// ---------------------------------------------------------------------------
// Runtime singletons
// ---------------------------------------------------------------------------

const runtimeLocationHistoryStore = new InMemoryLocationHistoryStore();
const runtimeLocationLatestStateCache = new InMemoryLocationLatestStateCache();
const runtimeLocationMapLayerStore = new InMemoryLocationMapLayerStore();
export const runtimeMapDataServices = new MapDataServices({
  latestStateCache: runtimeLocationLatestStateCache,
  historyStore: runtimeLocationHistoryStore,
  mapLayerStore: runtimeLocationMapLayerStore,
});
let runtimeLocationSeeded = false;

const RUNTIME_MAP_LAYER_SEED = [
  {
    schemaVersion: 1,
    mapLayerId: 'ml-ws1-floor1',
    tenantId: 'workspace-1',
    siteId: 'site-a',
    floorId: 'floor-1',
    layerType: 'Floorplan' as const,
    coordinateFrame: 'floor-1',
    origin: { x: 0, y: 0, z: 0 },
    version: 1,
    validFromIso: '2026-02-20T00:00:00.000Z',
    provenance: {
      sourceType: 'CadImport' as const,
      sourceRef: 'floor-1-v1',
      registeredAtIso: '2026-02-20T00:00:00.000Z',
      registeredBy: 'ops-admin',
    },
  },
  {
    schemaVersion: 1,
    mapLayerId: 'ml-ws2-floor1',
    tenantId: 'workspace-2',
    siteId: 'site-z',
    floorId: 'floor-1',
    layerType: 'Floorplan' as const,
    coordinateFrame: 'floor-1',
    origin: { x: 0, y: 0, z: 0 },
    version: 1,
    validFromIso: '2026-02-20T00:00:00.000Z',
    provenance: {
      sourceType: 'CadImport' as const,
      sourceRef: 'floor-1-v1',
      registeredAtIso: '2026-02-20T00:00:00.000Z',
      registeredBy: 'ops-admin',
    },
  },
] as const;

const RUNTIME_LOCATION_EVENT_SEED = [
  {
    schemaVersion: 1,
    locationEventId: 'loc-evt-1',
    tenantId: 'workspace-1',
    assetId: 'asset-1',
    robotId: 'robot-1',
    sourceStreamId: 'stream-1',
    sourceType: 'SLAM',
    coordinateFrame: 'floor-1',
    observedAtIso: '2026-02-20T10:00:00.000Z',
    ingestedAtIso: '2026-02-20T10:00:00.100Z',
    pose: { x: 1, y: 2, z: 0, yawRadians: 0.2 },
    quality: { status: 'Known', horizontalStdDevMeters: 0.2 },
    correlationId: 'corr-location-1',
  },
  {
    schemaVersion: 1,
    locationEventId: 'loc-evt-2',
    tenantId: 'workspace-1',
    assetId: 'asset-1',
    robotId: 'robot-1',
    sourceStreamId: 'stream-2',
    sourceType: 'RTLS',
    coordinateFrame: 'floor-1',
    observedAtIso: '2026-02-20T10:05:00.000Z',
    ingestedAtIso: '2026-02-20T10:05:00.100Z',
    pose: { x: 2, y: 3, z: 0, yawRadians: 0.3 },
    quality: { status: 'Known', horizontalStdDevMeters: 0.3 },
    correlationId: 'corr-location-2',
  },
  {
    schemaVersion: 1,
    locationEventId: 'loc-evt-3',
    tenantId: 'workspace-2',
    assetId: 'asset-2',
    robotId: 'robot-2',
    sourceStreamId: 'stream-3',
    sourceType: 'SLAM',
    coordinateFrame: 'floor-1',
    observedAtIso: '2026-02-20T10:02:00.000Z',
    ingestedAtIso: '2026-02-20T10:02:00.100Z',
    pose: { x: 3, y: 4, z: 0, yawRadians: 0.4 },
    quality: { status: 'Known', horizontalStdDevMeters: 0.25 },
    correlationId: 'corr-location-3',
  },
] as const;

export async function ensureRuntimeLocationDataSeeded(): Promise<void> {
  if (runtimeLocationSeeded) return;
  runtimeLocationSeeded = true;
  await seedRuntimeMapLayers();
  await seedRuntimeLocationEvents();
}

async function seedRuntimeMapLayers(): Promise<void> {
  for (const mapLayer of RUNTIME_MAP_LAYER_SEED) {
    await parseAndStoreMapLayer(runtimeLocationMapLayerStore, mapLayer);
  }
}

async function seedRuntimeLocationEvents(): Promise<void> {
  for (const rawEvent of RUNTIME_LOCATION_EVENT_SEED) {
    const event = parseLocationEventV1(rawEvent);
    await runtimeLocationHistoryStore.append(event);
    await runtimeLocationLatestStateCache.put(event);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseLocationTelemetryPurpose(
  value: string | null,
): 'operations' | 'incident-response' | 'compliance-audit' {
  if (value === 'operations' || value === 'incident-response' || value === 'compliance-audit')
    return value;
  return 'incident-response';
}

function parsePositiveIntegerQueryParam(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseLocationSourceType(
  value: string | null,
): 'GPS' | 'RTLS' | 'SLAM' | 'odometry' | 'fusion' | undefined {
  return value === 'GPS' ||
    value === 'RTLS' ||
    value === 'SLAM' ||
    value === 'odometry' ||
    value === 'fusion'
    ? value
    : undefined;
}

function parseMapLayerType(
  value: string | null,
): 'Floorplan' | 'OccupancyGrid' | 'Geofence' | 'SemanticZone' | undefined {
  return value === 'Floorplan' ||
    value === 'OccupancyGrid' ||
    value === 'Geofence' ||
    value === 'SemanticZone'
    ? value
    : undefined;
}

function buildLocationHistoryQuery(
  url: URL,
  workspaceId: string,
  fromIso: string,
  toIso: string,
): Parameters<typeof runtimeMapDataServices.queryHistory>[0] {
  const limit = parsePositiveIntegerQueryParam(url.searchParams.get('limit'));
  const sourceType = parseLocationSourceType(url.searchParams.get('sourceType'));
  return {
    tenantId: workspaceId,
    fromIso,
    toIso,
    ...(url.searchParams.get('assetId') ? { assetId: url.searchParams.get('assetId')! } : {}),
    ...(url.searchParams.get('siteId') ? { siteId: url.searchParams.get('siteId')! } : {}),
    ...(url.searchParams.get('floorId') ? { floorId: url.searchParams.get('floorId')! } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(limit ? { limit } : {}),
  };
}

function buildMapLayerQuery(
  url: URL,
  workspaceId: string,
): Parameters<typeof runtimeMapDataServices.listMapLayers>[0] {
  const layerType = parseMapLayerType(url.searchParams.get('layerType'));
  const versionRaw = url.searchParams.get('version');
  const version = versionRaw ? Number.parseInt(versionRaw, 10) : undefined;
  return {
    tenantId: workspaceId,
    ...(url.searchParams.get('siteId') ? { siteId: url.searchParams.get('siteId')! } : {}),
    ...(url.searchParams.get('floorId') ? { floorId: url.searchParams.get('floorId')! } : {}),
    ...(layerType ? { layerType } : {}),
    ...(version && !Number.isNaN(version) ? { version } : {}),
  };
}

async function respondLocationHistory(
  input: Readonly<{
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    traceContext: TraceContext;
    pathname: string;
    workspaceId: string;
    url: URL;
    fromIso: string;
    toIso: string;
  }>,
): Promise<void> {
  try {
    const historyQuery = buildLocationHistoryQuery(
      input.url,
      input.workspaceId,
      input.fromIso,
      input.toIso,
    );
    const items = await runtimeMapDataServices.queryHistory(historyQuery);
    respondJson(input.res, {
      statusCode: 200,
      correlationId: input.correlationId,
      traceContext: input.traceContext,
      body: paginate(items, input.req.url ?? '/'),
    });
  } catch (error) {
    respondProblem(
      input.res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: error instanceof Error ? error.message : 'Invalid location-events query.',
        instance: input.pathname,
      },
      input.correlationId,
      input.traceContext,
    );
  }
}

async function authorizeReadRequest(args: HandlerArgs): Promise<AppContext | null> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;
  const auth = await authenticate(deps, {
    req,
    correlationId,
    traceContext,
    expectedWorkspaceId: workspaceId,
  });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return null;
  }
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return null;
  }
  return auth.ctx;
}

// ---------------------------------------------------------------------------
// Handler arg types
// ---------------------------------------------------------------------------

type HandlerArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  workspaceId: string;
  traceContext: TraceContext;
}>;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleLocationEventsStream(args: HandlerArgs): Promise<void> {
  const { req, res, correlationId, pathname, workspaceId, traceContext } = args;
  const appCtx = await authorizeReadRequest(args);
  if (!appCtx) return;

  const url = new URL(req.url ?? '/', 'http://localhost');
  const purpose = parseLocationTelemetryPurpose(url.searchParams.get('purpose'));
  const boundary = enforceLocationTelemetryBoundary(
    appCtx,
    { mode: 'live', purpose },
    undefined,
    new Date(),
  );
  if (!boundary.ok) {
    respondProblem(res, problemFromError(boundary.error, pathname), correlationId, traceContext);
    return;
  }
  await ensureRuntimeLocationDataSeeded();
  const assetId = url.searchParams.get('assetId') ?? 'asset-1';
  const latest = await runtimeMapDataServices.getLatestPose(workspaceId, assetId);
  const staleAfterSeconds = 30;
  const stale = !latest || Date.now() - Date.parse(latest.observedAtIso) > staleAfterSeconds * 1000;
  res.statusCode = 200;
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache');
  res.setHeader('connection', 'keep-alive');
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('traceparent', traceContext.traceparent);
  if (traceContext.tracestate) res.setHeader('tracestate', traceContext.tracestate);
  res.write(
    `event: stream-metadata\ndata: ${JSON.stringify({ staleAfterSeconds, stale, lastObservedAtIso: latest?.observedAtIso ?? null })}\n\n`,
  );
  res.write(`event: location\ndata: ${JSON.stringify(latest)}\n\n`);
  res.end();
}

export async function handleListLocationEvents(args: HandlerArgs): Promise<void> {
  const { req, res, correlationId, pathname, workspaceId, traceContext } = args;
  const appCtx = await authorizeReadRequest(args);
  if (!appCtx) return;

  const url = new URL(req.url ?? '/', 'http://localhost');
  const fromIso = url.searchParams.get('fromIso') ?? undefined;
  const toIso = url.searchParams.get('toIso') ?? undefined;
  const purpose = parseLocationTelemetryPurpose(url.searchParams.get('purpose'));
  const boundaryRequest =
    fromIso && toIso
      ? { mode: 'history' as const, purpose, fromIso, toIso }
      : { mode: 'history' as const, purpose };
  const boundary = enforceLocationTelemetryBoundary(appCtx, boundaryRequest, undefined, new Date());
  if (!boundary.ok) {
    respondProblem(res, problemFromError(boundary.error, pathname), correlationId, traceContext);
    return;
  }
  await ensureRuntimeLocationDataSeeded();
  await respondLocationHistory({
    req,
    res,
    correlationId,
    traceContext,
    pathname,
    workspaceId,
    url,
    fromIso: fromIso!,
    toIso: toIso!,
  });
}

export async function handleListMapLayers(args: HandlerArgs): Promise<void> {
  const { req, res, correlationId, workspaceId, traceContext } = args;
  if (!(await authorizeReadRequest(args))) return;
  await ensureRuntimeLocationDataSeeded();
  const url = new URL(req.url ?? '/', 'http://localhost');
  const mapLayerQuery = buildMapLayerQuery(url, workspaceId);
  const items = await runtimeMapDataServices.listMapLayers(mapLayerQuery);
  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: paginate(items, req.url ?? '/'),
  });
}
