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
import {
  type ErrorFactory,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'CloudEvent', CloudEventParseError);

  const specversion = readString(record, 'specversion', CloudEventParseError);
  if (specversion !== '1.0') {
    throw new CloudEventParseError(`Unsupported specversion: ${specversion}`);
  }

  const id = readString(record, 'id', CloudEventParseError);
  const source = readString(record, 'source', CloudEventParseError);
  const type = readString(record, 'type', CloudEventParseError);

  const subject = readOptionalString(record, 'subject', CloudEventParseError);
  const time = readOptionalIsoTime(record, 'time', CloudEventParseError);
  const datacontenttype = readOptionalString(record, 'datacontenttype', CloudEventParseError);
  const dataschema = readOptionalString(record, 'dataschema', CloudEventParseError);

  const data = record['data'];
  const dataBase64Raw = record['data_base64'];
  const data_base64 = readOptionalNonEmptyString(
    dataBase64Raw,
    'data_base64',
    CloudEventParseError,
  );

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
  const record = readRecord(value, 'CloudEvent', CloudEventParseError);

  const base = parseCloudEventV1(record);

  const tenantidRaw = readString(record, 'tenantid', CloudEventParseError);
  const correlationidRaw = readString(record, 'correlationid', CloudEventParseError);
  const runidRaw = readOptionalString(record, 'runid', CloudEventParseError);
  const actionidRaw = readOptionalString(record, 'actionid', CloudEventParseError);

  return {
    ...base,
    tenantid: TenantId(tenantidRaw),
    correlationid: CorrelationId(correlationidRaw),
    ...(runidRaw ? { runid: RunId(runidRaw) } : {}),
    ...(actionidRaw ? { actionid: ActionId(actionidRaw) } : {}),
  };
}

function readOptionalNonEmptyString(
  value: unknown,
  key: string,
  createError: ErrorFactory,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new createError(`${key} must be a non-empty string when provided.`);
  }
  return value;
}

function readOptionalIsoTime(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): string | undefined {
  const value = readOptionalString(record, key, createError);
  if (value !== undefined) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new createError(`${key} must be a valid ISO timestamp.`);
    }
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
