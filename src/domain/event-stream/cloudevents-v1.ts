import {
  ActionId,
  CorrelationId,
  RunId,
  TenantId,
  type ActionId as ActionIdType,
  type CorrelationId as CorrelationIdType,
  type RunId as RunIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';

export type CloudEventsSpecVersion = '1.0';

export type CloudEventV1 = Readonly<{
  specversion: CloudEventsSpecVersion;
  id: string;
  source: string;
  type: string;
  subject?: string;
  time?: string;
  datacontenttype?: string;
  dataschema?: string;
  data?: unknown;
  data_base64?: string;
}>;

interface CloudEventV1OptionalFields {
  subject?: string;
  time?: string;
  datacontenttype?: string;
  dataschema?: string;
  data?: unknown;
  data_base64?: string;
}

export type PortariumCloudEventV1 = Readonly<
  CloudEventV1 & {
    tenantid: TenantIdType;
    correlationid: CorrelationIdType;
    runid?: RunIdType;
    actionid?: ActionIdType;
  }
>;

export class CloudEventParseError extends Error {
  public override readonly name = 'CloudEventParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseCloudEventV1(value: unknown): CloudEventV1 {
  if (!isRecord(value)) throw new CloudEventParseError('CloudEvent must be an object.');

  const specversion = readString(value, 'specversion');
  if (specversion !== '1.0') {
    throw new CloudEventParseError(`Unsupported specversion: ${specversion}`);
  }

  const id = readString(value, 'id');
  const source = readString(value, 'source');
  const type = readString(value, 'type');

  const subject = readOptionalString(value, 'subject');
  const time = readOptionalString(value, 'time');
  const datacontenttype = readOptionalString(value, 'datacontenttype');
  const dataschema = readOptionalString(value, 'dataschema');

  const data = value['data'];
  const dataBase64Raw = value['data_base64'];
  const data_base64 = readOptionalNonEmptyString(dataBase64Raw, 'data_base64');

  if (data !== undefined && data_base64 !== undefined) {
    throw new CloudEventParseError('CloudEvent cannot include both data and data_base64.');
  }

  const optionalFields = buildCloudEventOptionalFields({
    subject,
    time,
    datacontenttype,
    dataschema,
    data,
    data_base64,
  });

  return { specversion: '1.0', id, source, type, ...optionalFields };
}

export function parsePortariumCloudEventV1(value: unknown): PortariumCloudEventV1 {
  if (!isRecord(value)) throw new CloudEventParseError('CloudEvent must be an object.');

  const base = parseCloudEventV1(value);

  const tenantidRaw = readString(value, 'tenantid');
  const correlationidRaw = readString(value, 'correlationid');

  const runidRaw = readOptionalString(value, 'runid');
  const actionidRaw = readOptionalString(value, 'actionid');

  return {
    ...base,
    tenantid: TenantId(tenantidRaw),
    correlationid: CorrelationId(correlationidRaw),
    ...(runidRaw ? { runid: RunId(runidRaw) } : {}),
    ...(actionidRaw ? { actionid: ActionId(actionidRaw) } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new CloudEventParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new CloudEventParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readOptionalNonEmptyString(value: unknown, key: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CloudEventParseError(`${key} must be a non-empty string when provided.`);
  }
  return value;
}

function buildCloudEventOptionalFields(params: {
  subject: string | undefined;
  time: string | undefined;
  datacontenttype: string | undefined;
  dataschema: string | undefined;
  data: unknown;
  data_base64: string | undefined;
}): CloudEventV1OptionalFields {
  const out: CloudEventV1OptionalFields = {};

  if (params.subject !== undefined) out.subject = params.subject;
  if (params.time !== undefined) out.time = params.time;
  if (params.datacontenttype !== undefined) out.datacontenttype = params.datacontenttype;
  if (params.dataschema !== undefined) out.dataschema = params.dataschema;
  if (params.data !== undefined) out.data = params.data;
  if (params.data_base64 !== undefined) out.data_base64 = params.data_base64;

  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
