/**
 * Block-based presentation DSL for approval evidence (bead-yd14).
 *
 * Defines a typed, composable set of "blocks" that represent how evidence
 * is structured for display.  This is the canonical intermediate representation
 * between raw evidence data and any UI renderer.
 *
 * The DSL is a pure domain concern — no HTTP, no DB, no framework imports.
 * Renderers (React, CLI, PDF) consume `PresentationDocument` and map each
 * block type to their native widget.
 *
 * Blocks:
 *   - header:          Section heading (level 1–3)
 *   - metadata:        Key-value field list
 *   - timeline:        Chronological evidence entries
 *   - payloadRef:      Reference to an external artifact/log/snapshot
 *   - chainIntegrity:  Hash-chain verification summary
 *   - summary:         Human-readable status message with severity
 *   - separator:       Visual divider between sections
 */

import type { EvidenceEntryV1, EvidenceActor } from './evidence-entry-v1.js';

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

export type HeaderBlock = Readonly<{
  blockType: 'header';
  level: 1 | 2 | 3;
  text: string;
}>;

export type MetadataField = Readonly<{
  label: string;
  value: string;
}>;

export type MetadataBlock = Readonly<{
  blockType: 'metadata';
  fields: readonly MetadataField[];
}>;

export type TimelineEntry = Readonly<{
  evidenceId: string;
  occurredAtIso: string;
  category: string;
  summary: string;
  actorLabel: string;
}>;

export type TimelineBlock = Readonly<{
  blockType: 'timeline';
  entries: readonly TimelineEntry[];
}>;

export type PayloadRefBlock = Readonly<{
  blockType: 'payloadRef';
  kind: 'Artifact' | 'Snapshot' | 'Diff' | 'Log';
  uri: string;
  contentType?: string;
  sha256?: string;
}>;

export type ChainIntegrityBlock = Readonly<{
  blockType: 'chainIntegrity';
  state: 'none' | 'verified' | 'broken';
  entryCount: number;
  brokenAtIndex?: number;
}>;

export type SummaryBlock = Readonly<{
  blockType: 'summary';
  text: string;
  severity: 'info' | 'warning' | 'error';
}>;

export type SeparatorBlock = Readonly<{
  blockType: 'separator';
}>;

/** Union of all block types in the presentation DSL. */
export type PresentationBlock =
  | HeaderBlock
  | MetadataBlock
  | TimelineBlock
  | PayloadRefBlock
  | ChainIntegrityBlock
  | SummaryBlock
  | SeparatorBlock;

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

/**
 * An ordered, immutable list of presentation blocks that fully describes
 * how a set of evidence entries should be rendered.
 */
export type PresentationDocument = Readonly<{
  schemaVersion: 1;
  blocks: readonly PresentationBlock[];
}>;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isHeaderBlock(b: PresentationBlock): b is HeaderBlock {
  return b.blockType === 'header';
}

export function isMetadataBlock(b: PresentationBlock): b is MetadataBlock {
  return b.blockType === 'metadata';
}

export function isTimelineBlock(b: PresentationBlock): b is TimelineBlock {
  return b.blockType === 'timeline';
}

export function isPayloadRefBlock(b: PresentationBlock): b is PayloadRefBlock {
  return b.blockType === 'payloadRef';
}

export function isChainIntegrityBlock(b: PresentationBlock): b is ChainIntegrityBlock {
  return b.blockType === 'chainIntegrity';
}

export function isSummaryBlock(b: PresentationBlock): b is SummaryBlock {
  return b.blockType === 'summary';
}

export function isSeparatorBlock(b: PresentationBlock): b is SeparatorBlock {
  return b.blockType === 'separator';
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a `PresentationDocument` from a list of evidence entries.
 *
 * The document is structured as:
 *   1. Header
 *   2. Metadata summary (workspace, entry count, time range)
 *   3. Separator
 *   4. Chain integrity status
 *   5. Separator
 *   6. Timeline of entries
 *   7. Payload references (if any)
 *   8. Summary
 *
 * The returned document is deeply frozen.
 */
export function buildEvidencePresentationDocument(
  entries: readonly EvidenceEntryV1[],
): PresentationDocument {
  const blocks: PresentationBlock[] = [];

  // Header
  blocks.push({ blockType: 'header', level: 1, text: 'Evidence Trail' });

  if (entries.length === 0) {
    blocks.push({
      blockType: 'summary',
      text: 'No evidence entries recorded.',
      severity: 'info',
    });
    return deepFreezeDocument({ schemaVersion: 1, blocks });
  }

  // Metadata
  blocks.push(buildMetadataBlock(entries));

  blocks.push({ blockType: 'separator' });

  // Chain integrity
  blocks.push(buildChainIntegrityBlock(entries));

  blocks.push({ blockType: 'separator' });

  // Timeline
  blocks.push(buildTimelineBlock(entries));

  // Payload refs
  const payloadBlocks = buildPayloadRefBlocks(entries);
  if (payloadBlocks.length > 0) {
    blocks.push({ blockType: 'separator' });
    blocks.push({ blockType: 'header', level: 2, text: 'Attachments' });
    blocks.push(...payloadBlocks);
  }

  // Summary
  const integrity = blocks.find(isChainIntegrityBlock);
  if (integrity?.state === 'broken') {
    blocks.push({
      blockType: 'summary',
      text: `Evidence chain integrity broken at entry ${String(integrity.brokenAtIndex)}.`,
      severity: 'error',
    });
  } else {
    blocks.push({
      blockType: 'summary',
      text: `${String(entries.length)} evidence entries verified.`,
      severity: 'info',
    });
  }

  return deepFreezeDocument({ schemaVersion: 1, blocks });
}

// ---------------------------------------------------------------------------
// Internal block builders
// ---------------------------------------------------------------------------

function buildMetadataBlock(entries: readonly EvidenceEntryV1[]): MetadataBlock {
  const first = entries[0]!;
  const last = entries[entries.length - 1]!;

  const fields: MetadataField[] = [
    { label: 'Workspace', value: String(first.workspaceId) },
    { label: 'Entries', value: String(entries.length) },
    { label: 'First Entry', value: first.occurredAtIso },
    { label: 'Latest Entry', value: last.occurredAtIso },
  ];

  return { blockType: 'metadata', fields };
}

function buildChainIntegrityBlock(entries: readonly EvidenceEntryV1[]): ChainIntegrityBlock {
  if (entries.length === 0) {
    return { blockType: 'chainIntegrity', state: 'none', entryCount: 0 };
  }

  // Verify previousHash links (lightweight — does not re-hash, just checks links)
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1]!;
    const curr = entries[i]!;
    if (curr.previousHash !== prev.hashSha256) {
      return {
        blockType: 'chainIntegrity',
        state: 'broken',
        entryCount: entries.length,
        brokenAtIndex: i,
      };
    }
  }

  return { blockType: 'chainIntegrity', state: 'verified', entryCount: entries.length };
}

function buildTimelineBlock(entries: readonly EvidenceEntryV1[]): TimelineBlock {
  return {
    blockType: 'timeline',
    entries: entries.map((e) => ({
      evidenceId: String(e.evidenceId),
      occurredAtIso: e.occurredAtIso,
      category: e.category,
      summary: e.summary,
      actorLabel: formatActorLabel(e.actor),
    })),
  };
}

function buildPayloadRefBlocks(entries: readonly EvidenceEntryV1[]): PayloadRefBlock[] {
  const blocks: PayloadRefBlock[] = [];
  for (const entry of entries) {
    if (entry.payloadRefs) {
      for (const ref of entry.payloadRefs) {
        blocks.push({
          blockType: 'payloadRef',
          kind: ref.kind,
          uri: ref.uri,
          ...(ref.contentType ? { contentType: ref.contentType } : {}),
          ...(ref.sha256 ? { sha256: String(ref.sha256) } : {}),
        });
      }
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatActorLabel(actor: EvidenceActor): string {
  switch (actor.kind) {
    case 'User':
      return `User: ${String(actor.userId)}`;
    case 'Machine':
      return `Machine: ${String(actor.machineId)}`;
    case 'Adapter':
      return `Adapter: ${String(actor.adapterId)}`;
    case 'System':
      return 'System';
  }
}

function deepFreezeDocument(doc: {
  schemaVersion: 1;
  blocks: PresentationBlock[];
}): PresentationDocument {
  for (const block of doc.blocks) {
    if ('fields' in block && Array.isArray(block.fields)) {
      for (const field of block.fields) {
        Object.freeze(field);
      }
      Object.freeze(block.fields);
    }
    if ('entries' in block && Array.isArray(block.entries)) {
      for (const entry of block.entries) {
        Object.freeze(entry);
      }
      Object.freeze(block.entries);
    }
    Object.freeze(block);
  }
  Object.freeze(doc.blocks);
  Object.freeze(doc);
  return doc;
}
