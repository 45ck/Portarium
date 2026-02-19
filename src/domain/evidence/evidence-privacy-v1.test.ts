import { describe, expect, it } from 'vitest';

import { CorrelationId, EvidenceId, WorkspaceId } from '../primitives/index.js';
import {
  assertEvidencePrivacyMinimizationV1,
  EvidencePrivacyViolationError,
} from './evidence-privacy-v1.js';
import type { EvidenceEntryV1WithoutHash } from './evidence-entry-v1.js';

function validEntry(): EvidenceEntryV1WithoutHash {
  return {
    schemaVersion: 1,
    evidenceId: EvidenceId('ev-1'),
    workspaceId: WorkspaceId('ws-1'),
    correlationId: CorrelationId('corr-1'),
    occurredAtIso: '2026-02-18T00:00:00.000Z',
    category: 'System',
    summary: 'Run completed for opaque ref customer-4829.',
    actor: { kind: 'System' },
    links: {
      externalRefs: [
        {
          sorName: 'crm',
          portFamily: 'CrmSales',
          externalId: 'cust-4829',
          externalType: 'contact',
        },
      ],
    },
    payloadRefs: [{ kind: 'Diff', uri: 'memory://runs/run-1/diff.json' }],
  };
}

describe('Evidence privacy minimization v1', () => {
  it('accepts minimised metadata and opaque references', () => {
    expect(() => assertEvidencePrivacyMinimizationV1(validEntry())).not.toThrow();
  });

  it('rejects email addresses in immutable summary', () => {
    const entry: EvidenceEntryV1WithoutHash = {
      ...validEntry(),
      summary: 'Action approved by alice@example.com',
    };
    expect(() => assertEvidencePrivacyMinimizationV1(entry)).toThrow(EvidencePrivacyViolationError);
  });

  it('rejects email addresses in external reference ids', () => {
    const entry: EvidenceEntryV1WithoutHash = {
      ...validEntry(),
      links: {
      externalRefs: [
        {
          sorName: 'crm',
          portFamily: 'CrmSales',
          externalId: 'alice@example.com',
          externalType: 'contact',
        },
      ],
      },
    };
    expect(() => assertEvidencePrivacyMinimizationV1(entry)).toThrow(EvidencePrivacyViolationError);
  });

  it('rejects query strings and fragments in payload URIs', () => {
    const withQuery: EvidenceEntryV1WithoutHash = {
      ...validEntry(),
      payloadRefs: [{ kind: 'Snapshot', uri: 's3://bucket/key?email=alice@example.com' }],
    };
    expect(() => assertEvidencePrivacyMinimizationV1(withQuery)).toThrow(
      EvidencePrivacyViolationError,
    );

    const withFragment: EvidenceEntryV1WithoutHash = {
      ...validEntry(),
      payloadRefs: [{ kind: 'Snapshot', uri: 's3://bucket/key#section' }],
    };
    expect(() => assertEvidencePrivacyMinimizationV1(withFragment)).toThrow(
      EvidencePrivacyViolationError,
    );
  });
});
