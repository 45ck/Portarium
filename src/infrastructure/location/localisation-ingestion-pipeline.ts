import { createPortariumCloudEvent } from '../../application/events/cloudevent.js';
import {
  parsePortariumCloudEventV1,
  type PortariumCloudEventV1,
} from '../../domain/event-stream/cloudevents-v1.js';
import {
  parseLocationEventV1,
  type LocationEventV1,
} from '../../domain/location/location-event-v1.js';
import {
  CorrelationId,
  LocationEventId,
  SourceStreamId,
  TenantId,
} from '../../domain/primitives/index.js';

export interface LocalisationIngestionDeps {
  idGenerator: Readonly<{ generateId(): string }>;
  clock: Readonly<{ nowIso(): string }>;
  latestStateCache: LocationLatestStateCache;
  historyStore: LocationHistoryStore;
  deadLetterStore: LocationDeadLetterStore;
  defaultFramesBySourceType?: Partial<Record<LocationInputSourceType, string>>;
}

export interface LocationLatestStateCache {
  put(event: LocationEventV1): Promise<void>;
  get(tenantId: string, assetId: string): Promise<LocationEventV1 | null>;
}

export interface LocationHistoryStore {
  append(event: LocationEventV1): Promise<void>;
  getLastBySourceStream(tenantId: string, sourceStreamId: string): Promise<LocationEventV1 | null>;
  listByAsset(tenantId: string, assetId: string): Promise<readonly LocationEventV1[]>;
  listByTenant(tenantId: string): Promise<readonly LocationEventV1[]>;
}

export interface LocationDeadLetterStore {
  append(entry: LocationDeadLetterEntry): Promise<void>;
  list(tenantId: string): Promise<readonly LocationDeadLetterEntry[]>;
}

export type LocationDeadLetterEntry = Readonly<{
  tenantId: string;
  occurredAtIso: string;
  reason: string;
  payload: unknown;
}>;

export type LocalisationIngestionResult =
  | Readonly<{ ok: true; event: LocationEventV1; cloudEvent: PortariumCloudEventV1 }>
  | Readonly<{ ok: false; deadLetter: LocationDeadLetterEntry }>;

type LocationInputSourceType = 'GPS' | 'RTLS' | 'SLAM' | 'odometry';

type LocalisationInputBase = Readonly<{
  tenantId: string;
  assetId: string;
  robotId?: string;
  sourceStreamId: string;
  sourceType: LocationInputSourceType;
  observedAtIso: string;
  coordinateFrame?: string;
  correlationId: string;
}>;

export type GpsLocalisationInput = LocalisationInputBase &
  Readonly<{
    sourceType: 'GPS';
    latitude: number;
    longitude: number;
    altitudeMeters?: number;
    headingDegrees?: number;
    horizontalAccuracyMeters?: number;
    verticalAccuracyMeters?: number;
  }>;

export type RtlsLocalisationInput = LocalisationInputBase &
  Readonly<{
    sourceType: 'RTLS';
    xMeters: number;
    yMeters: number;
    zMeters?: number;
    headingDegrees?: number;
    horizontalAccuracyMeters?: number;
    verticalAccuracyMeters?: number;
  }>;

export type SlamLocalisationInput = LocalisationInputBase &
  Readonly<{
    sourceType: 'SLAM' | 'odometry';
    pose: Readonly<{
      x: number;
      y: number;
      z: number;
      yawRadians: number;
    }>;
    velocity?: Readonly<{
      linearMetersPerSec: number;
      angularRadiansPerSec: number;
    }>;
    qualityKnown?: Readonly<{
      horizontalStdDevMeters: number;
      verticalStdDevMeters?: number;
    }>;
  }>;

export type LocalisationInput =
  | GpsLocalisationInput
  | RtlsLocalisationInput
  | SlamLocalisationInput;

const LOCATION_INGESTION_SOURCE = 'portarium.infrastructure.location-ingestion';

export class LocalisationIngestionPipeline {
  readonly #deps: LocalisationIngestionDeps;

  public constructor(deps: LocalisationIngestionDeps) {
    this.#deps = deps;
  }

  public async ingest(input: LocalisationInput): Promise<LocalisationIngestionResult> {
    const nowIso = this.#deps.clock.nowIso();
    try {
      const sourceStreamId = SourceStreamId(input.sourceStreamId);
      const tenantId = TenantId(input.tenantId);
      const previous = await this.#deps.historyStore.getLastBySourceStream(
        input.tenantId,
        input.sourceStreamId,
      );
      const event = parseLocationEventV1(
        toLocationEventRecord({
          input,
          locationEventId: LocationEventId(this.#deps.idGenerator.generateId()),
          ingestedAtIso: nowIso,
          coordinateFrame: this.resolveCoordinateFrame(input),
        }),
        previous ? { previousObservedAtIso: previous.observedAtIso } : undefined,
      );

      await this.#deps.historyStore.append(event);
      await this.#deps.latestStateCache.put(event);

      const cloudEvent = createPortariumCloudEvent({
        source: LOCATION_INGESTION_SOURCE,
        eventType: 'com.portarium.location.LocationEventIngested',
        eventId: this.#deps.idGenerator.generateId(),
        tenantId,
        correlationId: CorrelationId(input.correlationId),
        subject: `assets/${input.assetId}`,
        occurredAtIso: input.observedAtIso,
        data: {
          locationEventId: event.locationEventId,
          assetId: event.assetId,
          sourceStreamId,
          sourceType: event.sourceType,
        },
      });
      parsePortariumCloudEventV1(cloudEvent);
      return { ok: true, event, cloudEvent };
    } catch (error) {
      const deadLetter: LocationDeadLetterEntry = {
        tenantId: input.tenantId,
        occurredAtIso: nowIso,
        reason: error instanceof Error ? error.message : 'Unknown ingestion error.',
        payload: input,
      };
      await this.#deps.deadLetterStore.append(deadLetter);
      return { ok: false, deadLetter };
    }
  }

  private resolveCoordinateFrame(input: LocalisationInput): string {
    if (input.coordinateFrame && input.coordinateFrame.trim() !== '') {
      return input.coordinateFrame;
    }
    const mapped = this.#deps.defaultFramesBySourceType?.[input.sourceType];
    if (mapped && mapped.trim() !== '') {
      return mapped;
    }
    throw new Error(`Missing coordinate frame for source type ${input.sourceType}.`);
  }
}

function toLocationEventRecord(args: {
  input: LocalisationInput;
  locationEventId: string;
  ingestedAtIso: string;
  coordinateFrame: string;
}): Record<string, unknown> {
  const base = {
    schemaVersion: 1,
    locationEventId: args.locationEventId,
    tenantId: args.input.tenantId,
    assetId: args.input.assetId,
    ...(args.input.robotId ? { robotId: args.input.robotId } : {}),
    sourceStreamId: args.input.sourceStreamId,
    sourceType: args.input.sourceType,
    coordinateFrame: args.coordinateFrame,
    observedAtIso: args.input.observedAtIso,
    ingestedAtIso: args.ingestedAtIso,
    correlationId: args.input.correlationId,
  };

  switch (args.input.sourceType) {
    case 'GPS':
      return gpsLocationEventRecord(base, args.input);
    case 'RTLS':
      return rtlsLocationEventRecord(base, args.input);
    case 'SLAM':
    case 'odometry':
      return slamLocationEventRecord(base, args.input);
  }
}

function convertGpsToPose(latitude: number, longitude: number, altitudeMeters: number) {
  // Lightweight equirectangular approximation for a normalized local pose.
  return {
    x: longitude * 111_320,
    y: latitude * 110_540,
    z: altitudeMeters,
    yawRadians: 0,
  };
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function keyOf(tenantId: string, key: string): string {
  return `${tenantId}/${key}`;
}

export class InMemoryLocationLatestStateCache implements LocationLatestStateCache {
  readonly #latestByAsset = new Map<string, LocationEventV1>();

  public put(event: LocationEventV1): Promise<void> {
    this.#latestByAsset.set(keyOf(String(event.tenantId), String(event.assetId)), event);
    return Promise.resolve();
  }

  public get(tenantId: string, assetId: string): Promise<LocationEventV1 | null> {
    return Promise.resolve(this.#latestByAsset.get(keyOf(tenantId, assetId)) ?? null);
  }
}

export class InMemoryLocationHistoryStore implements LocationHistoryStore {
  readonly #events: LocationEventV1[] = [];

  public append(event: LocationEventV1): Promise<void> {
    this.#events.push(event);
    return Promise.resolve();
  }

  public getLastBySourceStream(
    tenantId: string,
    sourceStreamId: string,
  ): Promise<LocationEventV1 | null> {
    for (let i = this.#events.length - 1; i >= 0; i -= 1) {
      const entry = this.#events[i]!;
      if (String(entry.tenantId) === tenantId && String(entry.sourceStreamId) === sourceStreamId) {
        return Promise.resolve(entry);
      }
    }
    return Promise.resolve(null);
  }

  public listByAsset(tenantId: string, assetId: string): Promise<readonly LocationEventV1[]> {
    return Promise.resolve(
      this.#events.filter(
        (event) => String(event.tenantId) === tenantId && String(event.assetId) === assetId,
      ),
    );
  }

  public listByTenant(tenantId: string): Promise<readonly LocationEventV1[]> {
    return Promise.resolve(this.#events.filter((event) => String(event.tenantId) === tenantId));
  }
}

export class InMemoryLocationDeadLetterStore implements LocationDeadLetterStore {
  readonly #entries: LocationDeadLetterEntry[] = [];

  public append(entry: LocationDeadLetterEntry): Promise<void> {
    this.#entries.push(entry);
    return Promise.resolve();
  }

  public list(tenantId: string): Promise<readonly LocationDeadLetterEntry[]> {
    return Promise.resolve(this.#entries.filter((entry) => entry.tenantId === tenantId));
  }
}

function gpsLocationEventRecord(
  base: Record<string, unknown>,
  input: GpsLocalisationInput,
): Record<string, unknown> {
  const pose = convertGpsToPose(input.latitude, input.longitude, input.altitudeMeters ?? 0);
  return {
    ...base,
    pose,
    quality: knownOrUnknownAccuracyQuality(
      input.horizontalAccuracyMeters,
      input.verticalAccuracyMeters,
      'GPS accuracy metadata not provided.',
    ),
  };
}

function rtlsLocationEventRecord(
  base: Record<string, unknown>,
  input: RtlsLocalisationInput,
): Record<string, unknown> {
  return {
    ...base,
    pose: {
      x: input.xMeters,
      y: input.yMeters,
      z: input.zMeters ?? 0,
      yawRadians: degreesToRadians(input.headingDegrees ?? 0),
    },
    quality: knownOrUnknownAccuracyQuality(
      input.horizontalAccuracyMeters,
      input.verticalAccuracyMeters,
      'RTLS accuracy metadata not provided.',
    ),
  };
}

function slamLocationEventRecord(
  base: Record<string, unknown>,
  input: SlamLocalisationInput,
): Record<string, unknown> {
  return {
    ...base,
    pose: input.pose,
    ...(input.velocity ? { velocity: input.velocity } : {}),
    quality: input.qualityKnown
      ? {
          status: 'Known',
          horizontalStdDevMeters: input.qualityKnown.horizontalStdDevMeters,
          ...(input.qualityKnown.verticalStdDevMeters !== undefined
            ? { verticalStdDevMeters: input.qualityKnown.verticalStdDevMeters }
            : {}),
        }
      : { status: 'Unknown', reason: `${input.sourceType} covariance not provided.` },
  };
}

function knownOrUnknownAccuracyQuality(
  horizontalAccuracyMeters: number | undefined,
  verticalAccuracyMeters: number | undefined,
  unknownReason: string,
): Record<string, unknown> {
  if (horizontalAccuracyMeters === undefined) {
    return { status: 'Unknown', reason: unknownReason };
  }

  return {
    status: 'Known',
    horizontalStdDevMeters: horizontalAccuracyMeters,
    ...(verticalAccuracyMeters !== undefined
      ? { verticalStdDevMeters: verticalAccuracyMeters }
      : {}),
  };
}
