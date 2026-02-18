import {
  CampaignId,
  TenantId,
  type CampaignId as CampaignIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readEnum,
  readInteger,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;
type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type CampaignV1 = Readonly<{
  campaignId: CampaignIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  name: string;
  status: CampaignStatus;
  channelType?: string;
  startDateIso?: string;
  endDateIso?: string;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class CampaignParseError extends Error {
  public override readonly name = 'CampaignParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseCampaignV1(value: unknown): CampaignV1 {
  const record = readRecord(value, 'Campaign', CampaignParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', CampaignParseError);
  if (schemaVersion !== 1) {
    throw new CampaignParseError('schemaVersion must be 1.');
  }

  const campaignId = CampaignId(readString(record, 'campaignId', CampaignParseError));
  const tenantId = TenantId(readString(record, 'tenantId', CampaignParseError));
  const name = readString(record, 'name', CampaignParseError);
  const status = readEnum(record, 'status', CAMPAIGN_STATUSES, CampaignParseError);
  const channelType = readOptionalString(record, 'channelType', CampaignParseError);
  const startDateIso = readOptionalIsoString(record, 'startDateIso', CampaignParseError);
  const endDateIso = readOptionalIsoString(record, 'endDateIso', CampaignParseError);
  const externalRefs = readOptionalExternalRefs(record);

  return {
    campaignId,
    tenantId,
    schemaVersion: 1,
    name,
    status,
    ...(channelType ? { channelType } : {}),
    ...(startDateIso ? { startDateIso } : {}),
    ...(endDateIso ? { endDateIso } : {}),
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new CampaignParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}
