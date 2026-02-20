import {
  PrivacyPolicyId,
  TenantId,
  type PrivacyPolicyId as PrivacyPolicyIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import {
  assertNotBefore,
  readEnum,
  readInteger,
  readIsoString,
  readOptionalIsoString,
  readOptionalNonNegativeInteger,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
  readString,
} from '../validation/parse-utils.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

const PRIVACY_POLICY_OPT_IN_STATUSES = [
  'opted_in',
  'opted_out',
  'pending_double_opt_in',
  'unknown',
] as const;
type PrivacyPolicyDefaultOptInStatus = (typeof PRIVACY_POLICY_OPT_IN_STATUSES)[number];

export type PrivacyPolicyV1 = Readonly<{
  privacyPolicyId: PrivacyPolicyIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  name: string;
  versionLabel: string;
  effectiveFromIso: string;
  effectiveToIso?: string;
  defaultOptInStatus: PrivacyPolicyDefaultOptInStatus;
  suppressionListNames?: readonly string[];
  auditRetentionDays?: number;
  policyDocumentUrl?: string;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class PrivacyPolicyParseError extends Error {
  public override readonly name = 'PrivacyPolicyParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parsePrivacyPolicyV1(value: unknown): PrivacyPolicyV1 {
  const record = readRecord(value, 'PrivacyPolicy', PrivacyPolicyParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PrivacyPolicyParseError);
  if (schemaVersion !== 1) {
    throw new PrivacyPolicyParseError('schemaVersion must be 1.');
  }

  const privacyPolicyId = PrivacyPolicyId(
    readString(record, 'privacyPolicyId', PrivacyPolicyParseError),
  );
  const tenantId = TenantId(readString(record, 'tenantId', PrivacyPolicyParseError));
  const name = readString(record, 'name', PrivacyPolicyParseError);
  const versionLabel = readString(record, 'versionLabel', PrivacyPolicyParseError);
  const effectiveFromIso = readIsoString(record, 'effectiveFromIso', PrivacyPolicyParseError);
  const effectiveToIso = readOptionalIsoString(record, 'effectiveToIso', PrivacyPolicyParseError);
  const defaultOptInStatus = readEnum(
    record,
    'defaultOptInStatus',
    PRIVACY_POLICY_OPT_IN_STATUSES,
    PrivacyPolicyParseError,
  );
  const suppressionListNames = readOptionalSuppressionListNames(record);
  const auditRetentionDays = readOptionalNonNegativeInteger(
    record,
    'auditRetentionDays',
    PrivacyPolicyParseError,
  );
  const policyDocumentUrl = readOptionalString(
    record,
    'policyDocumentUrl',
    PrivacyPolicyParseError,
  );
  const externalRefs = readOptionalExternalRefs(record);

  if (effectiveToIso) {
    assertNotBefore(effectiveFromIso, effectiveToIso, PrivacyPolicyParseError, {
      anchorLabel: 'effectiveFromIso',
      laterLabel: 'effectiveToIso',
    });
  }

  return {
    privacyPolicyId,
    tenantId,
    schemaVersion: 1,
    name,
    versionLabel,
    effectiveFromIso,
    defaultOptInStatus,
    ...(effectiveToIso ? { effectiveToIso } : {}),
    ...(suppressionListNames ? { suppressionListNames } : {}),
    ...(auditRetentionDays !== undefined ? { auditRetentionDays } : {}),
    ...(policyDocumentUrl ? { policyDocumentUrl } : {}),
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readOptionalSuppressionListNames(
  record: Record<string, unknown>,
): readonly string[] | undefined {
  const suppressionListNames = readOptionalStringArray(
    record,
    'suppressionListNames',
    PrivacyPolicyParseError,
    { minLength: 1 },
  );
  if (!suppressionListNames) {
    return undefined;
  }

  const seen = new Set<string>();
  for (const listName of suppressionListNames) {
    const normalized = listName.trim().toLowerCase();
    if (seen.has(normalized)) {
      throw new PrivacyPolicyParseError(
        `suppressionListNames contains duplicate value: ${listName}.`,
      );
    }
    seen.add(normalized);
  }
  return suppressionListNames;
}

function readOptionalExternalRefs(
  record: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const value = record['externalRefs'];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new PrivacyPolicyParseError('externalRefs must be an array when provided.');
  }

  return value.map((item, index) => {
    try {
      return parseExternalObjectRef(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new PrivacyPolicyParseError(`externalRefs[${index}] invalid: ${message}`);
    }
  });
}
