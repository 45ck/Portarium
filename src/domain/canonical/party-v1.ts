import {
  PartyId,
  TenantId,
  type PartyId as PartyIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readInteger,
  readOptionalString,
  readRecord,
  readString,
  readStringArray,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Party', PartyParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PartyParseError);
  if (schemaVersion !== 1) {
    throw new PartyParseError('schemaVersion must be 1.');
  }

  const partyId = PartyId(readString(record, 'partyId', PartyParseError));
  const tenantId = TenantId(readString(record, 'tenantId', PartyParseError));
  const displayName = readString(record, 'displayName', PartyParseError);
  const email = readOptionalString(record, 'email', PartyParseError);
  const phone = readOptionalString(record, 'phone', PartyParseError);
  const roles = readStringArray(record, 'roles', PartyParseError, { minLength: 1 });
  const externalRefs = readOptionalExternalRefs(record);

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
