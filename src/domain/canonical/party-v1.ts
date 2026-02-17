import {
  PartyId,
  TenantId,
  type PartyId as PartyIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

export type PartyV1 = Readonly<{
  partyId: PartyIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  displayName: string;
  email?: string;
  phone?: string;
  roles: readonly string[];
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class PartyParseError extends Error {
  public override readonly name = 'PartyParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parsePartyV1(value: unknown): PartyV1 {
  if (!isRecord(value)) {
    throw new PartyParseError('Party must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new PartyParseError('schemaVersion must be 1.');
  }

  const partyId = PartyId(readString(value, 'partyId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const displayName = readString(value, 'displayName');
  const email = readOptionalString(value, 'email');
  const phone = readOptionalString(value, 'phone');
  const roles = readNonEmptyStringArray(value, 'roles');
  const externalRefs = readOptionalExternalRefs(value);

  return {
    partyId,
    tenantId,
    schemaVersion: 1,
    displayName,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    roles,
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PartyParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PartyParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNonEmptyStringArray(obj: Record<string, unknown>, key: string): readonly string[] {
  const v = obj[key];
  if (!Array.isArray(v) || v.length === 0) {
    throw new PartyParseError(`${key} must be a non-empty array.`);
  }
  for (const item of v) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new PartyParseError(`${key} must contain only non-empty strings.`);
    }
  }
  return v as string[];
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new PartyParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
