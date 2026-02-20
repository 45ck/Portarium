import {
  ConsentId,
  PartyId,
  TenantId,
  type ConsentId as ConsentIdType,
  type PartyId as PartyIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import {
  assertNotBefore,
  readEnum,
  readInteger,
  readIsoString,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

const CONSENT_OPT_IN_STATUSES = [
  'opted_in',
  'opted_out',
  'pending_double_opt_in',
  'unknown',
] as const;
export type ConsentOptInStatus = (typeof CONSENT_OPT_IN_STATUSES)[number];

const CONSENT_CHANNELS = ['email', 'sms', 'push', 'phone', 'in_app', 'postal'] as const;
type ConsentChannel = (typeof CONSENT_CHANNELS)[number];

const CONSENT_AUDIT_ACTIONS = [
  'granted',
  'revoked',
  'updated',
  'suppressed',
  'unsuppressed',
  'imported',
] as const;
type ConsentAuditAction = (typeof CONSENT_AUDIT_ACTIONS)[number];

export type ConsentSuppressionEntryV1 = Readonly<{
  listName: string;
  addedAtIso: string;
  reason?: string;
  expiresAtIso?: string;
}>;

export type ConsentAuditEntryV1 = Readonly<{
  occurredAtIso: string;
  action: ConsentAuditAction;
  optInStatus: ConsentOptInStatus;
  actorType?: string;
  actorId?: string;
  source?: string;
  reason?: string;
}>;

export type ConsentV1 = Readonly<{
  consentId: ConsentIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  partyId: PartyIdType;
  purpose: string;
  channel: ConsentChannel;
  optInStatus: ConsentOptInStatus;
  capturedAtIso?: string;
  revokedAtIso?: string;
  suppressionEntries?: readonly ConsentSuppressionEntryV1[];
  auditTrail?: readonly ConsentAuditEntryV1[];
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class ConsentParseError extends Error {
  public override readonly name = 'ConsentParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseConsentV1(value: unknown): ConsentV1 {
  const record = readRecord(value, 'Consent', ConsentParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', ConsentParseError);
  if (schemaVersion !== 1) {
    throw new ConsentParseError('schemaVersion must be 1.');
  }

  const consentId = ConsentId(readString(record, 'consentId', ConsentParseError));
  const tenantId = TenantId(readString(record, 'tenantId', ConsentParseError));
  const partyId = PartyId(readString(record, 'partyId', ConsentParseError));
  const purpose = readString(record, 'purpose', ConsentParseError);
  const channel = readEnum(record, 'channel', CONSENT_CHANNELS, ConsentParseError);
  const optInStatus = readEnum(record, 'optInStatus', CONSENT_OPT_IN_STATUSES, ConsentParseError);
  const capturedAtIso = readOptionalIsoString(record, 'capturedAtIso', ConsentParseError);
  const revokedAtIso = readOptionalIsoString(record, 'revokedAtIso', ConsentParseError);
  const suppressionEntries = readOptionalSuppressionEntries(record);
  const auditTrail = readOptionalAuditTrail(record);
  const externalRefs = readOptionalExternalRefs(record);

  if (capturedAtIso && revokedAtIso) {
    assertNotBefore(capturedAtIso, revokedAtIso, ConsentParseError, {
      anchorLabel: 'capturedAtIso',
      laterLabel: 'revokedAtIso',
    });
  }

  if (auditTrail) {
    const latest = auditTrail.at(-1);
    if (latest && latest.optInStatus !== optInStatus) {
      throw new ConsentParseError(
        'optInStatus must match the final auditTrail entry optInStatus when auditTrail is provided.',
      );
    }
  }

  return buildConsent({
    consentId,
    tenantId,
    partyId,
    purpose,
    channel,
    optInStatus,
    capturedAtIso,
    revokedAtIso,
    suppressionEntries,
    auditTrail,
    externalRefs,
  });
}

function buildConsent(input: {
  consentId: ConsentIdType;
  tenantId: TenantIdType;
  partyId: PartyIdType;
  purpose: string;
  channel: ConsentChannel;
  optInStatus: ConsentOptInStatus;
  capturedAtIso: string | undefined;
  revokedAtIso: string | undefined;
  suppressionEntries: readonly ConsentSuppressionEntryV1[] | undefined;
  auditTrail: readonly ConsentAuditEntryV1[] | undefined;
  externalRefs: readonly ExternalObjectRef[] | undefined;
}): ConsentV1 {
  const consent: {
    consentId: ConsentIdType;
    tenantId: TenantIdType;
    schemaVersion: 1;
    partyId: PartyIdType;
    purpose: string;
    channel: ConsentChannel;
    optInStatus: ConsentOptInStatus;
    capturedAtIso?: string;
    revokedAtIso?: string;
    suppressionEntries?: readonly ConsentSuppressionEntryV1[];
    auditTrail?: readonly ConsentAuditEntryV1[];
    externalRefs?: readonly ExternalObjectRef[];
  } = {
    consentId: input.consentId,
    tenantId: input.tenantId,
    schemaVersion: 1,
    partyId: input.partyId,
    purpose: input.purpose,
    channel: input.channel,
    optInStatus: input.optInStatus,
  };

  if (input.capturedAtIso) consent.capturedAtIso = input.capturedAtIso;
  if (input.revokedAtIso) consent.revokedAtIso = input.revokedAtIso;
  if (input.suppressionEntries) consent.suppressionEntries = input.suppressionEntries;
  if (input.auditTrail) consent.auditTrail = input.auditTrail;
  if (input.externalRefs) consent.externalRefs = input.externalRefs;

  return consent;
}

function readOptionalSuppressionEntries(
  record: Record<string, unknown>,
): readonly ConsentSuppressionEntryV1[] | undefined {
  const value = record['suppressionEntries'];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new ConsentParseError('suppressionEntries must be a non-empty array when provided.');
  }

  const parsed = value.map((entry, idx) => parseSuppressionEntry(entry, idx));
  assertUniqueSuppressionLists(parsed);
  return parsed;
}

function parseSuppressionEntry(value: unknown, index: number): ConsentSuppressionEntryV1 {
  const path = `suppressionEntries[${index}]`;
  const record = readRecord(value, path, ConsentParseError);
  const listName = readString(record, 'listName', ConsentParseError, { path });
  const addedAtIso = readIsoString(record, 'addedAtIso', ConsentParseError);
  const reason = readOptionalString(record, 'reason', ConsentParseError, { path });
  const expiresAtIso = readOptionalIsoString(record, 'expiresAtIso', ConsentParseError);

  if (expiresAtIso) {
    assertNotBefore(addedAtIso, expiresAtIso, ConsentParseError, {
      anchorLabel: `${path}.addedAtIso`,
      laterLabel: `${path}.expiresAtIso`,
    });
  }

  return {
    listName,
    addedAtIso,
    ...(reason ? { reason } : {}),
    ...(expiresAtIso ? { expiresAtIso } : {}),
  };
}

function assertUniqueSuppressionLists(entries: readonly ConsentSuppressionEntryV1[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    const normalized = entry.listName.trim().toLowerCase();
    if (seen.has(normalized)) {
      throw new ConsentParseError(
        `suppressionEntries contains duplicate listName: ${entry.listName}.`,
      );
    }
    seen.add(normalized);
  }
}

function readOptionalAuditTrail(
  record: Record<string, unknown>,
): readonly ConsentAuditEntryV1[] | undefined {
  const value = record['auditTrail'];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new ConsentParseError('auditTrail must be a non-empty array when provided.');
  }

  const parsed: ConsentAuditEntryV1[] = [];
  for (const [index, entry] of value.entries()) {
    const auditEntry = parseAuditEntry(entry, index);
    const previous = parsed.at(-1);
    if (previous) {
      assertNotBefore(previous.occurredAtIso, auditEntry.occurredAtIso, ConsentParseError, {
        anchorLabel: `auditTrail[${index - 1}].occurredAtIso`,
        laterLabel: `auditTrail[${index}].occurredAtIso`,
      });
    }
    parsed.push(auditEntry);
  }

  return parsed;
}

function parseAuditEntry(value: unknown, index: number): ConsentAuditEntryV1 {
  const path = `auditTrail[${index}]`;
  const record = readRecord(value, path, ConsentParseError);
  const occurredAtIso = readIsoString(record, 'occurredAtIso', ConsentParseError);
  const action = readEnum(record, 'action', CONSENT_AUDIT_ACTIONS, ConsentParseError);
  const optInStatus = readEnum(record, 'optInStatus', CONSENT_OPT_IN_STATUSES, ConsentParseError);
  const actorType = readOptionalString(record, 'actorType', ConsentParseError, { path });
  const actorId = readOptionalString(record, 'actorId', ConsentParseError, { path });
  const source = readOptionalString(record, 'source', ConsentParseError, { path });
  const reason = readOptionalString(record, 'reason', ConsentParseError, { path });

  return {
    occurredAtIso,
    action,
    optInStatus,
    ...(actorType ? { actorType } : {}),
    ...(actorId ? { actorId } : {}),
    ...(source ? { source } : {}),
    ...(reason ? { reason } : {}),
  };
}

function readOptionalExternalRefs(
  record: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const value = record['externalRefs'];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ConsentParseError('externalRefs must be an array when provided.');
  }

  return value.map((item, index) => {
    try {
      return parseExternalObjectRef(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ConsentParseError(`externalRefs[${index}] invalid: ${message}`);
    }
  });
}
