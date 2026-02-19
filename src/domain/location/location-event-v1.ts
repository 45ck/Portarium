import {
  AssetId,
  CorrelationId,
  LocationEventId,
  RobotId,
  SourceStreamId,
  TenantId,
  unbrand,
  type AssetId as AssetIdType,
  type CorrelationId as CorrelationIdType,
  type LocationEventId as LocationEventIdType,
  type RobotId as RobotIdType,
  type SourceStreamId as SourceStreamIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import {
  assertNotBefore,
  parseIsoDate,
  readFiniteNumber,
  readIsoString,
  readOptionalFiniteNumber,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

const LOCATION_SOURCE_TYPES = ['GPS', 'RTLS', 'SLAM', 'odometry', 'fusion'] as const;

export type LocationSourceType = (typeof LOCATION_SOURCE_TYPES)[number];

export type LocationPoseV1 = Readonly<{
  x: number;
  y: number;
  z: number;
  yawRadians: number;
}>;

export type LocationVelocityV1 = Readonly<{
  linearMetersPerSec: number;
  angularRadiansPerSec: number;
}>;

export type LocationQualityKnownV1 = Readonly<{
  status: 'Known';
  horizontalStdDevMeters: number;
  verticalStdDevMeters?: number;
}>;

export type LocationQualityUnknownV1 = Readonly<{
  status: 'Unknown';
  reason: string;
}>;

export type LocationQualityV1 = LocationQualityKnownV1 | LocationQualityUnknownV1;

export type LocationEventV1 = Readonly<{
  schemaVersion: 1;
  locationEventId: LocationEventIdType;
  tenantId: TenantIdType;
  assetId: AssetIdType;
  robotId?: RobotIdType;
  sourceStreamId: SourceStreamIdType;
  sourceType: LocationSourceType;
  coordinateFrame: string;
  observedAtIso: string;
  ingestedAtIso: string;
  pose: LocationPoseV1;
  velocity?: LocationVelocityV1;
  quality: LocationQualityV1;
  correlationId: CorrelationIdType;
}>;

export class LocationEventParseError extends Error {
  public override readonly name = 'LocationEventParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseLocationEventV1(
  value: unknown,
  opts?: Readonly<{ previousObservedAtIso?: string }>,
): LocationEventV1 {
  const record = readRecord(value, 'LocationEvent', LocationEventParseError);

  const schemaVersion = record['schemaVersion'];
  if (schemaVersion !== 1) {
    throw new LocationEventParseError(`Unsupported schemaVersion: ${String(schemaVersion)}`);
  }

  const locationEventId = LocationEventId(
    readString(record, 'locationEventId', LocationEventParseError),
  );
  const tenantId = TenantId(readString(record, 'tenantId', LocationEventParseError));
  const assetId = AssetId(readString(record, 'assetId', LocationEventParseError));
  const robotIdRaw = readOptionalString(record, 'robotId', LocationEventParseError);
  const sourceStreamId = SourceStreamId(
    readString(record, 'sourceStreamId', LocationEventParseError),
  );
  const sourceType = parseSourceType(readString(record, 'sourceType', LocationEventParseError));
  const coordinateFrame = readString(record, 'coordinateFrame', LocationEventParseError);
  const observedAtIso = readIsoString(record, 'observedAtIso', LocationEventParseError);
  const ingestedAtIso = readIsoString(record, 'ingestedAtIso', LocationEventParseError);
  const pose = parsePose(record['pose']);
  const velocity = parseVelocity(record['velocity']);
  const quality = parseQuality(record['quality']);
  const correlationId = CorrelationId(readString(record, 'correlationId', LocationEventParseError));

  assertNotBefore(observedAtIso, ingestedAtIso, LocationEventParseError, {
    anchorLabel: 'observedAtIso',
    laterLabel: 'ingestedAtIso',
  });

  if (opts?.previousObservedAtIso !== undefined) {
    parseIsoDate(opts.previousObservedAtIso, 'previousObservedAtIso', LocationEventParseError);
    assertNotBefore(opts.previousObservedAtIso, observedAtIso, LocationEventParseError, {
      anchorLabel: 'previousObservedAtIso',
      laterLabel: 'observedAtIso',
    });
  }

  return {
    schemaVersion: 1,
    locationEventId,
    tenantId,
    assetId,
    ...(robotIdRaw !== undefined ? { robotId: RobotId(robotIdRaw) } : {}),
    sourceStreamId,
    sourceType,
    coordinateFrame,
    observedAtIso,
    ingestedAtIso,
    pose,
    ...(velocity !== undefined ? { velocity } : {}),
    quality,
    correlationId,
  };
}

export function assertMonotonicLocationEvents(events: readonly LocationEventV1[]): void {
  const lastObservedByStream = new Map<string, string>();
  for (const event of events) {
    const streamKey = unbrand(event.sourceStreamId);
    const previous = lastObservedByStream.get(streamKey);
    if (previous !== undefined) {
      assertNotBefore(previous, event.observedAtIso, LocationEventParseError, {
        anchorLabel: `sourceStream(${streamKey}) previous observedAtIso`,
        laterLabel: 'observedAtIso',
      });
    }
    lastObservedByStream.set(streamKey, event.observedAtIso);
  }
}

function parseSourceType(value: string): LocationSourceType {
  if ((LOCATION_SOURCE_TYPES as readonly string[]).includes(value)) {
    return value as LocationSourceType;
  }
  throw new LocationEventParseError(
    `sourceType must be one of: ${LOCATION_SOURCE_TYPES.join(', ')}.`,
  );
}

function parsePose(value: unknown): LocationPoseV1 {
  const pose = readRecord(value, 'pose', LocationEventParseError);
  return {
    x: readFiniteNumber(pose, 'x', LocationEventParseError),
    y: readFiniteNumber(pose, 'y', LocationEventParseError),
    z: readFiniteNumber(pose, 'z', LocationEventParseError),
    yawRadians: readFiniteNumber(pose, 'yawRadians', LocationEventParseError),
  };
}

function parseVelocity(value: unknown): LocationVelocityV1 | undefined {
  if (value === undefined) {
    return undefined;
  }
  const velocity = readRecord(value, 'velocity', LocationEventParseError);
  return {
    linearMetersPerSec: readFiniteNumber(velocity, 'linearMetersPerSec', LocationEventParseError),
    angularRadiansPerSec: readFiniteNumber(
      velocity,
      'angularRadiansPerSec',
      LocationEventParseError,
    ),
  };
}

function parseQuality(value: unknown): LocationQualityV1 {
  const quality = readRecord(value, 'quality', LocationEventParseError);
  const status = readString(quality, 'status', LocationEventParseError);
  if (status === 'Known') {
    const horizontalStdDevMeters = readFiniteNumber(
      quality,
      'horizontalStdDevMeters',
      LocationEventParseError,
    );
    if (horizontalStdDevMeters < 0) {
      throw new LocationEventParseError('quality.horizontalStdDevMeters must be non-negative.');
    }

    const verticalStdDevMeters = readOptionalFiniteNumber(
      quality,
      'verticalStdDevMeters',
      LocationEventParseError,
    );
    if (verticalStdDevMeters !== undefined && verticalStdDevMeters < 0) {
      throw new LocationEventParseError('quality.verticalStdDevMeters must be non-negative.');
    }

    return {
      status: 'Known',
      horizontalStdDevMeters,
      ...(verticalStdDevMeters !== undefined ? { verticalStdDevMeters } : {}),
    };
  }

  if (status === 'Unknown') {
    return {
      status: 'Unknown',
      reason: readString(quality, 'reason', LocationEventParseError),
    };
  }

  throw new LocationEventParseError('quality.status must be either Known or Unknown.');
}
