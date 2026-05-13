import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES } from './gslr-manual-bundle-adversarial-fixtures';
import {
  GslrEvidenceBundleVerificationError,
  verifyGslrEvidenceBundleV1,
} from '@portarium/domain-evidence';
import { HashSha256 } from '@portarium/domain-primitives';

const here = dirname(fileURLToPath(import.meta.url));
const corpusDir = join(here, 'gslr-14-adversarial-corpus');

const hasher = {
  sha256Hex(input: string) {
    return HashSha256(createHash('sha256').update(input, 'utf8').digest('hex'));
  },
};

const signatureVerifier = {
  verify(canonical: string, signatureBase64: string) {
    return signatureBase64 === Buffer.from(`sig:${canonical.length}`).toString('base64');
  },
};

describe('GSLR manual bundle adversarial corpus', () => {
  it('materializes every adversarial fixture as a portable bundle JSON file', () => {
    const manifest = JSON.parse(readFileSync(join(corpusDir, 'manifest.json'), 'utf8')) as {
      cases: readonly {
        caseId: string;
        sourceRef: string;
        expectedRejectionCode: string;
        expectedRejectionCategory: string;
      }[];
    };

    expect(manifest.cases.map((entry) => entry.caseId)).toEqual(
      GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES.map((fixture) => fixture.caseId),
    );

    for (const fixture of GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES) {
      const fileJson = readFileSync(join(corpusDir, `${fixture.caseId}.bundle.json`), 'utf8');
      const manifestEntry = manifest.cases.find((entry) => entry.caseId === fixture.caseId);

      expect(JSON.parse(fileJson), fixture.caseId).toEqual(JSON.parse(fixture.bundleJson));
      expect(manifestEntry?.sourceRef, fixture.caseId).toBe(fixture.sourceRef);
      expect(manifestEntry?.expectedRejectionCode, fixture.caseId).toBe(
        fixture.expectedRejectionCode,
      );
      expect(manifestEntry?.expectedRejectionCategory, fixture.caseId).toBe(
        fixture.expectedRejectionCategory,
      );
    }
  });

  it('rejects every portable adversarial file with the expected structured code', () => {
    for (const fixture of GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES) {
      const fileJson = readFileSync(join(corpusDir, `${fixture.caseId}.bundle.json`), 'utf8');

      try {
        verifyGslrEvidenceBundleV1(JSON.parse(fileJson), {
          hasher,
          signatureVerifier,
          nowIso: '2026-05-13T02:00:00.000Z',
        });
      } catch (error) {
        expect(error, fixture.caseId).toBeInstanceOf(GslrEvidenceBundleVerificationError);
        expect((error as GslrEvidenceBundleVerificationError).code, fixture.caseId).toBe(
          fixture.expectedRejectionCode,
        );
        expect((error as GslrEvidenceBundleVerificationError).category, fixture.caseId).toBe(
          fixture.expectedRejectionCategory,
        );
        continue;
      }

      throw new Error(`Expected ${fixture.caseId} to be rejected`);
    }
  });
});
