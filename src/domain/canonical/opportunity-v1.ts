import {
  OpportunityId,
  TenantId,
  type OpportunityId as OpportunityIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

export type OpportunityV1 = Readonly<{
  opportunityId: OpportunityIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  name: string;
  stage: string;
  amount?: number;
  currencyCode?: string;
  closeDate?: string;
  probability?: number;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class OpportunityParseError extends Error {
  public override readonly name = 'OpportunityParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseOpportunityV1(value: unknown): OpportunityV1 {
  if (!isRecord(value)) {
    throw new OpportunityParseError('Opportunity must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new OpportunityParseError('schemaVersion must be 1.');
  }

  const opportunityId = OpportunityId(readString(value, 'opportunityId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const name = readString(value, 'name');
  const stage = readString(value, 'stage');
  const amount = readOptionalNonNegativeNumber(value, 'amount');
  const currencyCode = readOptionalCurrencyCode(value, 'currencyCode');
  const closeDate = readOptionalString(value, 'closeDate');
  const probability = readOptionalProbability(value, 'probability');
  const externalRefs = readOptionalExternalRefs(value);

  return {
    opportunityId,
    tenantId,
    schemaVersion: 1,
    name,
    stage,
    ...(amount !== undefined ? { amount } : {}),
    ...(currencyCode ? { currencyCode } : {}),
    ...(closeDate ? { closeDate } : {}),
    ...(probability !== undefined ? { probability } : {}),
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new OpportunityParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new OpportunityParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readOptionalCurrencyCode(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new OpportunityParseError(
      `${key} must be a 3-letter uppercase currency code when provided.`,
    );
  }
  return v;
}

function readOptionalNonNegativeNumber(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new OpportunityParseError(`${key} must be a non-negative number when provided.`);
  }
  return v;
}

function readOptionalProbability(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) {
    throw new OpportunityParseError(`${key} must be a number between 0 and 100 when provided.`);
  }
  return v;
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new OpportunityParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
