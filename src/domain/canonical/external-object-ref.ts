import type { PortFamily } from '../primitives/index.js';
import { isPortFamily } from '../primitives/index.js';
import { readOptionalString, readRecord, readString } from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'ExternalObjectRef', ExternalObjectRefParseError);

  const sorName = readString(record, 'sorName', ExternalObjectRefParseError);

  const portFamilyRaw = readString(record, 'portFamily', ExternalObjectRefParseError);
  if (!isPortFamily(portFamilyRaw)) {
    throw new ExternalObjectRefParseError(`Invalid portFamily: "${portFamilyRaw}"`);
  }

  const externalId = readString(record, 'externalId', ExternalObjectRefParseError);
  const externalType = readString(record, 'externalType', ExternalObjectRefParseError);
  const displayLabel = readOptionalString(record, 'displayLabel', ExternalObjectRefParseError);
  const deepLinkUrl = readOptionalString(record, 'deepLinkUrl', ExternalObjectRefParseError);

  return {
    sorName,
    portFamily: portFamilyRaw,
    externalId,
    externalType,
    ...(displayLabel ? { displayLabel } : {}),
    ...(deepLinkUrl ? { deepLinkUrl } : {}),
  };
}
