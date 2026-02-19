import {
  FloorId,
  MapLayerId,
  SiteId,
  TenantId,
  type FloorId as FloorIdType,
  type MapLayerId as MapLayerIdType,
  type SiteId as SiteIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import {
  assertNotBefore,
  readFiniteNumber,
  readInteger,
  readIsoString,
  readOptionalInteger,
  readOptionalIsoString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

const MAP_LAYER_TYPES = ['Floorplan', 'OccupancyGrid', 'Geofence', 'SemanticZone'] as const;
const MAP_LAYER_PROVENANCE_TYPES = ['Survey', 'CadImport', 'RobotDerived', 'ManualEdit'] as const;

export type MapLayerType = (typeof MAP_LAYER_TYPES)[number];
export type MapLayerProvenanceType = (typeof MAP_LAYER_PROVENANCE_TYPES)[number];

export type MapLayerOriginV1 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type MapLayerProvenanceV1 = Readonly<{
  sourceType: MapLayerProvenanceType;
  sourceRef: string;
  registeredAtIso: string;
  registeredBy: string;
}>;

export type MapLayerV1 = Readonly<{
  schemaVersion: 1;
  mapLayerId: MapLayerIdType;
  tenantId: TenantIdType;
  siteId: SiteIdType;
  floorId: FloorIdType;
  layerType: MapLayerType;
  coordinateFrame: string;
  origin: MapLayerOriginV1;
  resolutionMetersPerCell?: number;
  version: number;
  validFromIso: string;
  validToIso?: string;
  provenance: MapLayerProvenanceV1;
  boundToMapVersion?: number;
}>;

export class MapLayerParseError extends Error {
  public override readonly name = 'MapLayerParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseMapLayerV1(value: unknown): MapLayerV1 {
  const record = readRecord(value, 'MapLayer', MapLayerParseError);
  assertSchemaVersion(record['schemaVersion']);

  const layerType = parseLayerType(readString(record, 'layerType', MapLayerParseError));
  const { validFromIso, validToIso } = parseValidityWindow(record);
  const version = parseLayerVersion(record);
  const boundToMapVersion = parseBoundMapVersion(record, layerType);
  const resolutionMetersPerCell = parseResolution(record, layerType);

  return {
    schemaVersion: 1,
    mapLayerId: MapLayerId(readString(record, 'mapLayerId', MapLayerParseError)),
    tenantId: TenantId(readString(record, 'tenantId', MapLayerParseError)),
    siteId: SiteId(readString(record, 'siteId', MapLayerParseError)),
    floorId: FloorId(readString(record, 'floorId', MapLayerParseError)),
    layerType,
    coordinateFrame: readString(record, 'coordinateFrame', MapLayerParseError),
    origin: parseOrigin(record['origin']),
    ...(resolutionMetersPerCell !== undefined ? { resolutionMetersPerCell } : {}),
    version,
    validFromIso,
    ...(validToIso !== undefined ? { validToIso } : {}),
    provenance: parseProvenance(record['provenance']),
    ...(boundToMapVersion !== undefined ? { boundToMapVersion } : {}),
  };
}

function assertSchemaVersion(value: unknown): void {
  if (value !== 1) {
    throw new MapLayerParseError(`Unsupported schemaVersion: ${String(value)}`);
  }
}

function parseValidityWindow(
  record: Record<string, unknown>,
): Readonly<{ validFromIso: string; validToIso?: string }> {
  const validFromIso = readIsoString(record, 'validFromIso', MapLayerParseError);
  const validToIso = readOptionalIsoString(record, 'validToIso', MapLayerParseError);
  if (validToIso !== undefined) {
    assertNotBefore(validFromIso, validToIso, MapLayerParseError, {
      anchorLabel: 'validFromIso',
      laterLabel: 'validToIso',
    });
  }
  return { validFromIso, ...(validToIso !== undefined ? { validToIso } : {}) };
}

function parseLayerVersion(record: Record<string, unknown>): number {
  const version = readInteger(record, 'version', MapLayerParseError);
  if (version < 1) {
    throw new MapLayerParseError('version must be >= 1.');
  }
  return version;
}

function parseBoundMapVersion(
  record: Record<string, unknown>,
  layerType: MapLayerType,
): number | undefined {
  const boundToMapVersion = readOptionalInteger(record, 'boundToMapVersion', MapLayerParseError);
  if (boundToMapVersion !== undefined && boundToMapVersion < 1) {
    throw new MapLayerParseError('boundToMapVersion must be >= 1 when provided.');
  }
  if (
    (layerType === 'Geofence' || layerType === 'SemanticZone') &&
    boundToMapVersion === undefined
  ) {
    throw new MapLayerParseError(`boundToMapVersion is required for layerType ${layerType}.`);
  }
  return boundToMapVersion;
}

function parseResolution(
  record: Record<string, unknown>,
  layerType: MapLayerType,
): number | undefined {
  const resolutionMetersPerCell = readOptionalFiniteNumber(record);
  if (layerType === 'OccupancyGrid' && resolutionMetersPerCell === undefined) {
    throw new MapLayerParseError('resolutionMetersPerCell is required for OccupancyGrid.');
  }
  return resolutionMetersPerCell;
}

function parseLayerType(value: string): MapLayerType {
  if ((MAP_LAYER_TYPES as readonly string[]).includes(value)) {
    return value as MapLayerType;
  }
  throw new MapLayerParseError(`layerType must be one of: ${MAP_LAYER_TYPES.join(', ')}.`);
}

function parseProvenanceType(value: string): MapLayerProvenanceType {
  if ((MAP_LAYER_PROVENANCE_TYPES as readonly string[]).includes(value)) {
    return value as MapLayerProvenanceType;
  }
  throw new MapLayerParseError(
    `provenance.sourceType must be one of: ${MAP_LAYER_PROVENANCE_TYPES.join(', ')}.`,
  );
}

function parseOrigin(value: unknown): MapLayerOriginV1 {
  const origin = readRecord(value, 'origin', MapLayerParseError);
  return {
    x: readFiniteNumber(origin, 'x', MapLayerParseError),
    y: readFiniteNumber(origin, 'y', MapLayerParseError),
    z: readFiniteNumber(origin, 'z', MapLayerParseError),
  };
}

function parseProvenance(value: unknown): MapLayerProvenanceV1 {
  const provenance = readRecord(value, 'provenance', MapLayerParseError);
  return {
    sourceType: parseProvenanceType(readString(provenance, 'sourceType', MapLayerParseError)),
    sourceRef: readString(provenance, 'sourceRef', MapLayerParseError),
    registeredAtIso: readIsoString(provenance, 'registeredAtIso', MapLayerParseError),
    registeredBy: readString(provenance, 'registeredBy', MapLayerParseError),
  };
}

function readOptionalFiniteNumber(record: Record<string, unknown>): number | undefined {
  const value = record['resolutionMetersPerCell'];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
    throw new MapLayerParseError('resolutionMetersPerCell must be a positive finite number.');
  }
  return value;
}
