import { describe, it, expect } from 'vitest';
import {
  type HeaderBlock,
  type MetadataBlock,
  type TimelineBlock,
  type PayloadRefBlock,
  type ChainIntegrityBlock,
  type SummaryBlock,
  type SeparatorBlock,
  buildEvidencePresentationDocument,
  isHeaderBlock,
  isMetadataBlock,
  isTimelineBlock,
  isPayloadRefBlock,
  isChainIntegrityBlock,
  isSummaryBlock,
  isSeparatorBlock,
} from './presentation-blocks-v1.js';
import type { EvidenceEntryV1 } from './evidence-entry-v1.js';
import type { CorrelationId, EvidenceId, HashSha256, WorkspaceId } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeHash(n: number): HashSha256 {
  return `sha256-${String(n).padStart(64, '0')}` as HashSha256;
}

function fakeEntry(overrides: Partial<EvidenceEntryV1> & { index: number }): EvidenceEntryV1 {
  const { index, ...rest } = overrides;
  return {
    schemaVersion: 1,
    evidenceId: `evi-${index}` as EvidenceId,
    workspaceId: 'ws-1' as WorkspaceId,
    correlationId: `cor-${index}` as CorrelationId,
    occurredAtIso: `2026-02-23T0${index}:00:00Z`,
    category: 'Approval',
    summary: `Evidence entry ${index}`,
    actor: { kind: 'User', userId: 'usr-1' as any },
    hashSha256: fakeHash(index),
    ...(index > 0 ? { previousHash: fakeHash(index - 1) } : {}),
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// Type guard tests
// ---------------------------------------------------------------------------

describe('PresentationBlock type guards', () => {
  const header: HeaderBlock = {
    blockType: 'header',
    level: 1,
    text: 'Test',
  };

  const metadata: MetadataBlock = {
    blockType: 'metadata',
    fields: [{ label: 'ID', value: 'test-id' }],
  };

  const timeline: TimelineBlock = {
    blockType: 'timeline',
    entries: [],
  };

  const payloadRef: PayloadRefBlock = {
    blockType: 'payloadRef',
    kind: 'Artifact',
    uri: 'https://example.com/file.pdf',
  };

  const chainIntegrity: ChainIntegrityBlock = {
    blockType: 'chainIntegrity',
    state: 'verified',
    entryCount: 3,
  };

  const summary: SummaryBlock = {
    blockType: 'summary',
    text: 'All good',
    severity: 'info',
  };

  const separator: SeparatorBlock = {
    blockType: 'separator',
  };

  it('isHeaderBlock identifies header blocks', () => {
    expect(isHeaderBlock(header)).toBe(true);
    expect(isHeaderBlock(metadata)).toBe(false);
  });

  it('isMetadataBlock identifies metadata blocks', () => {
    expect(isMetadataBlock(metadata)).toBe(true);
    expect(isMetadataBlock(header)).toBe(false);
  });

  it('isTimelineBlock identifies timeline blocks', () => {
    expect(isTimelineBlock(timeline)).toBe(true);
    expect(isTimelineBlock(header)).toBe(false);
  });

  it('isPayloadRefBlock identifies payloadRef blocks', () => {
    expect(isPayloadRefBlock(payloadRef)).toBe(true);
    expect(isPayloadRefBlock(header)).toBe(false);
  });

  it('isChainIntegrityBlock identifies chainIntegrity blocks', () => {
    expect(isChainIntegrityBlock(chainIntegrity)).toBe(true);
    expect(isChainIntegrityBlock(header)).toBe(false);
  });

  it('isSummaryBlock identifies summary blocks', () => {
    expect(isSummaryBlock(summary)).toBe(true);
    expect(isSummaryBlock(header)).toBe(false);
  });

  it('isSeparatorBlock identifies separator blocks', () => {
    expect(isSeparatorBlock(separator)).toBe(true);
    expect(isSeparatorBlock(header)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildEvidencePresentationDocument
// ---------------------------------------------------------------------------

describe('buildEvidencePresentationDocument', () => {
  it('returns a document with header and empty summary for zero entries', () => {
    const doc = buildEvidencePresentationDocument([]);

    expect(doc.schemaVersion).toBe(1);
    expect(doc.blocks.length).toBeGreaterThan(0);

    const headers = doc.blocks.filter(isHeaderBlock);
    expect(headers.length).toBeGreaterThanOrEqual(1);
    expect(headers[0]!.text).toMatch(/evidence/i);

    const summaries = doc.blocks.filter(isSummaryBlock);
    expect(summaries.length).toBeGreaterThanOrEqual(1);
    expect(summaries[0]!.text).toMatch(/no evidence/i);
  });

  it('produces metadata block with workspace and correlation info', () => {
    const entries = [fakeEntry({ index: 0 })];
    const doc = buildEvidencePresentationDocument(entries);

    const metaBlocks = doc.blocks.filter(isMetadataBlock);
    expect(metaBlocks.length).toBeGreaterThanOrEqual(1);

    const fields = metaBlocks.flatMap((m) => m.fields);
    const fieldLabels = fields.map((f) => f.label);
    expect(fieldLabels).toContain('Workspace');
    expect(fieldLabels).toContain('Entries');
  });

  it('produces a timeline block from multiple entries', () => {
    const entries = [fakeEntry({ index: 0 }), fakeEntry({ index: 1 }), fakeEntry({ index: 2 })];
    const doc = buildEvidencePresentationDocument(entries);

    const timelines = doc.blocks.filter(isTimelineBlock);
    expect(timelines.length).toBe(1);
    expect(timelines[0]!.entries).toHaveLength(3);

    const timestamps = timelines[0]!.entries.map((e) => e.occurredAtIso);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]! >= timestamps[i - 1]!).toBe(true);
    }
  });

  it('includes payloadRef blocks when entries have payloadRefs', () => {
    const entries = [
      fakeEntry({
        index: 0,
        payloadRefs: [
          {
            kind: 'Artifact',
            uri: 'https://example.com/report.pdf',
            contentType: 'application/pdf',
          },
          { kind: 'Log', uri: 's3://bucket/logs/run-123.jsonl' },
        ],
      }),
    ];
    const doc = buildEvidencePresentationDocument(entries);

    const refBlocks = doc.blocks.filter(isPayloadRefBlock);
    expect(refBlocks).toHaveLength(2);
    expect(refBlocks[0]!.kind).toBe('Artifact');
    expect(refBlocks[0]!.uri).toBe('https://example.com/report.pdf');
    expect(refBlocks[0]!.contentType).toBe('application/pdf');
    expect(refBlocks[1]!.kind).toBe('Log');
  });

  it('includes chain integrity block with verified state for valid chain', () => {
    const entries = [fakeEntry({ index: 0 }), fakeEntry({ index: 1 }), fakeEntry({ index: 2 })];
    const doc = buildEvidencePresentationDocument(entries);

    const integrity = doc.blocks.filter(isChainIntegrityBlock);
    expect(integrity).toHaveLength(1);
    expect(integrity[0]!.state).toBe('verified');
    expect(integrity[0]!.entryCount).toBe(3);
  });

  it('reports broken chain when previousHash link is invalid', () => {
    const entries = [
      fakeEntry({ index: 0 }),
      fakeEntry({ index: 1, previousHash: 'bad-hash' as HashSha256 }),
    ];
    const doc = buildEvidencePresentationDocument(entries);

    const integrity = doc.blocks.filter(isChainIntegrityBlock);
    expect(integrity).toHaveLength(1);
    expect(integrity[0]!.state).toBe('broken');
    expect(integrity[0]!.brokenAtIndex).toBe(1);
  });

  it('includes separators between logical sections', () => {
    const entries = [fakeEntry({ index: 0 }), fakeEntry({ index: 1 })];
    const doc = buildEvidencePresentationDocument(entries);

    const separators = doc.blocks.filter(isSeparatorBlock);
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });

  it('document blocks are deeply frozen (immutable)', () => {
    const entries = [fakeEntry({ index: 0 })];
    const doc = buildEvidencePresentationDocument(entries);

    expect(Object.isFrozen(doc)).toBe(true);
    expect(Object.isFrozen(doc.blocks)).toBe(true);
    for (const block of doc.blocks) {
      expect(Object.isFrozen(block)).toBe(true);
    }
  });

  it('handles mixed evidence categories', () => {
    const entries = [
      fakeEntry({ index: 0, category: 'Plan' }),
      fakeEntry({ index: 1, category: 'Action' }),
      fakeEntry({ index: 2, category: 'Approval' }),
      fakeEntry({ index: 3, category: 'Policy' }),
    ];
    const doc = buildEvidencePresentationDocument(entries);

    const timelines = doc.blocks.filter(isTimelineBlock);
    expect(timelines[0]!.entries).toHaveLength(4);
    const categories = timelines[0]!.entries.map((e) => e.category);
    expect(categories).toEqual(['Plan', 'Action', 'Approval', 'Policy']);
  });

  it('handles different actor kinds in timeline entries', () => {
    const entries = [
      fakeEntry({ index: 0, actor: { kind: 'User', userId: 'usr-1' as any } }),
      fakeEntry({ index: 1, actor: { kind: 'Machine', machineId: 'mch-1' as any } }),
      fakeEntry({ index: 2, actor: { kind: 'System' } }),
    ];
    const doc = buildEvidencePresentationDocument(entries);

    const timelines = doc.blocks.filter(isTimelineBlock);
    const actors = timelines[0]!.entries.map((e) => e.actorLabel);
    expect(actors[0]).toMatch(/usr-1/);
    expect(actors[1]).toMatch(/mch-1/);
    expect(actors[2]).toMatch(/system/i);
  });
});
