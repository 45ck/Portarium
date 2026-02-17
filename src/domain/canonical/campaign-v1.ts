import {
  CampaignId,
  TenantId,
  type CampaignId as CampaignIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

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
  if (!isRecord(value)) {
    throw new CampaignParseError('Campaign must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new CampaignParseError('schemaVersion must be 1.');
  }

  const campaignId = CampaignId(readString(value, 'campaignId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const name = readString(value, 'name');
  const status = readEnum(value, 'status', CAMPAIGN_STATUSES);
  const channelType = readOptionalString(value, 'channelType');
  const startDateIso = readOptionalString(value, 'startDateIso');
  const endDateIso = readOptionalString(value, 'endDateIso');
  const externalRefs = readOptionalExternalRefs(value);

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

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new CampaignParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new CampaignParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const v = obj[key];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new CampaignParseError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return v as T;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
