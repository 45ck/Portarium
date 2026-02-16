import type { PortFamily } from '../primitives/index.js';
import { isPortFamily } from '../primitives/index.js';

/**
 * ExternalObjectRef is the universal escape hatch for provider-specific entities.
 *
 * Per the glossary, it is a first-class deep link to any System of Record (SoR)
 * entity that does not map to a canonical object.
 */
export type ExternalObjectRef = Readonly<{
  sorName: string;
  portFamily: PortFamily;
  externalId: string;
  externalType: string;
  displayLabel?: string;
  deepLinkUrl?: string;
}>;

export class ExternalObjectRefParseError extends Error {
  public override readonly name = 'ExternalObjectRefParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseExternalObjectRef(value: unknown): ExternalObjectRef {
  if (!isRecord(value)) {
    throw new ExternalObjectRefParseError('ExternalObjectRef must be an object.');
  }

  const sorName = readString(value, 'sorName');

  const portFamilyRaw = readString(value, 'portFamily');
  if (!isPortFamily(portFamilyRaw)) {
    throw new ExternalObjectRefParseError(`Invalid portFamily: "${portFamilyRaw}"`);
  }

  const externalId = readString(value, 'externalId');
  const externalType = readString(value, 'externalType');
  const displayLabel = readOptionalString(value, 'displayLabel');
  const deepLinkUrl = readOptionalString(value, 'deepLinkUrl');

  return {
    sorName,
    portFamily: portFamilyRaw,
    externalId,
    externalType,
    ...(displayLabel ? { displayLabel } : {}),
    ...(deepLinkUrl ? { deepLinkUrl } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ExternalObjectRefParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ExternalObjectRefParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
