import type { EvidenceEntryV1WithoutHash } from './evidence-entry-v1.js';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export class EvidencePrivacyViolationError extends Error {
  public override readonly name = 'EvidencePrivacyViolationError';

  public constructor(message: string) {
    super(message);
  }
}

export function assertEvidencePrivacyMinimizationV1(entry: EvidenceEntryV1WithoutHash): void {
  if (EMAIL_PATTERN.test(entry.summary)) {
    throw new EvidencePrivacyViolationError(
      'Evidence summary must not include email addresses; use opaque identifiers.',
    );
  }

  const refs = entry.links?.externalRefs ?? [];
  for (const ref of refs) {
    if (EMAIL_PATTERN.test(ref.externalId)) {
      throw new EvidencePrivacyViolationError(
        'ExternalObjectRef.externalId must be opaque and must not include email addresses.',
      );
    }
  }

  const payloadRefs = entry.payloadRefs ?? [];
  for (const payload of payloadRefs) {
    if (payload.uri.includes('?') || payload.uri.includes('#')) {
      throw new EvidencePrivacyViolationError(
        'Evidence payloadRef.uri must not include query or fragment segments.',
      );
    }
  }
}
