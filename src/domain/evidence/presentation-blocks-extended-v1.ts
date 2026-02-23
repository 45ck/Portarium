/**
 * Extended presentation blocks for approval evidence (bead-0807).
 *
 * Extends the base presentation DSL (presentation-blocks-v1.ts) with
 * additional block types needed for the Universal Decision Surface:
 *
 *   - diff:           Side-by-side or unified diff of two text values
 *   - comparison:     Tabular before/after field comparison
 *   - preview:        Rich preview metadata for external resources
 *   - aiExplanation:  AI model explanation with confidence and reasoning
 *
 * These blocks are composable with the base block types and can be
 * included in any PresentationDocument.
 *
 * Part of bead-d5ta (Approval Workflows — Universal Decision Surface).
 */

import type { PresentationBlock as BasePresentationBlock } from './presentation-blocks-v1.js';

// ---------------------------------------------------------------------------
// Diff block
// ---------------------------------------------------------------------------

/** How a diff should be rendered by the UI layer. */
export type DiffDisplayMode = 'unified' | 'sideBySide';

/** A single line in a diff hunk. */
export type DiffLineV1 = Readonly<{
  /** Line operation. */
  op: 'add' | 'remove' | 'context';
  /** The text content of the line (without +/- prefix). */
  content: string;
  /** 1-based line number in the old version (undefined for additions). */
  oldLineNumber?: number;
  /** 1-based line number in the new version (undefined for removals). */
  newLineNumber?: number;
}>;

/** A contiguous group of changed lines within a diff. */
export type DiffHunkV1 = Readonly<{
  /** 1-based starting line in the old version. */
  oldStart: number;
  /** Number of lines in the old version. */
  oldCount: number;
  /** 1-based starting line in the new version. */
  newStart: number;
  /** Number of lines in the new version. */
  newCount: number;
  /** The lines in this hunk. */
  lines: readonly DiffLineV1[];
}>;

/**
 * A diff block shows what changed between two versions of a text value.
 *
 * Used for configuration diffs, code changes, policy text updates, etc.
 * The renderer chooses unified or side-by-side based on `displayMode`.
 */
export type DiffBlock = Readonly<{
  blockType: 'diff';
  /** Human-readable label for what is being diffed. */
  label: string;
  /** Label for the old version (e.g. "Before", "v1.2.0"). */
  oldLabel: string;
  /** Label for the new version (e.g. "After", "v1.3.0"). */
  newLabel: string;
  /** Preferred display mode. Renderers may override based on viewport. */
  displayMode: DiffDisplayMode;
  /** The diff hunks. */
  hunks: readonly DiffHunkV1[];
  /** Summary stats. */
  stats: Readonly<{
    additions: number;
    deletions: number;
    unchanged: number;
  }>;
}>;

// ---------------------------------------------------------------------------
// Comparison block
// ---------------------------------------------------------------------------

/** A single row in a before/after comparison table. */
export type ComparisonFieldV1 = Readonly<{
  /** Field label (e.g. "Amount", "Status", "Assignee"). */
  label: string;
  /** Value before the change. Undefined if field was added. */
  oldValue?: string;
  /** Value after the change. Undefined if field was removed. */
  newValue?: string;
  /** Whether this field changed (convenience for renderers). */
  changed: boolean;
}>;

/**
 * A comparison block shows a tabular before/after view of named fields.
 *
 * Used for structured data changes: approval payload updates,
 * configuration changes, permission changes, etc.
 */
export type ComparisonBlock = Readonly<{
  blockType: 'comparison';
  /** Human-readable title for the comparison. */
  title: string;
  /** The fields being compared. */
  fields: readonly ComparisonFieldV1[];
  /** Count of fields that changed. */
  changedCount: number;
  /** Count of fields that were unchanged. */
  unchangedCount: number;
}>;

// ---------------------------------------------------------------------------
// Preview block
// ---------------------------------------------------------------------------

/** The kind of preview content. Renderers use this to pick a widget. */
export type PreviewKind = 'document' | 'image' | 'table' | 'json' | 'markdown' | 'unknown';

/**
 * A preview block shows a rich preview of an external resource.
 *
 * The block contains only metadata — the actual content is loaded
 * by the renderer from the URI.  This design keeps the presentation
 * document small and avoids embedding large payloads.
 *
 * Security: URIs must pass content sanitization (content-sanitization-v1)
 * before inclusion.  Renderers must apply CSP constraints and sandbox
 * any loaded content.
 */
export type PreviewBlock = Readonly<{
  blockType: 'preview';
  /** Human-readable label for the preview. */
  label: string;
  /** URI to the resource being previewed. Must pass URI sanitization. */
  uri: string;
  /** MIME type of the resource (e.g. "application/pdf", "image/png"). */
  contentType: string;
  /** What kind of preview widget the renderer should use. */
  previewKind: PreviewKind;
  /** Optional: file size in bytes (for display). */
  sizeBytes?: number;
  /** Optional: SHA-256 hash of the content for integrity verification. */
  sha256?: string;
  /** Optional: alt text for accessibility. */
  altText?: string;
}>;

// ---------------------------------------------------------------------------
// AI explanation block
// ---------------------------------------------------------------------------

/** Confidence band for AI explanations. */
export type AiConfidenceBand = 'high' | 'medium' | 'low' | 'insufficient_data';

/** A single step in the AI's reasoning chain. */
export type AiReasoningStepV1 = Readonly<{
  /** 1-based step number. */
  stepNumber: number;
  /** Human-readable description of this reasoning step. */
  description: string;
  /** Optional: evidence or data this step is based on. */
  basis?: string;
}>;

/** A source the AI cited in its explanation. */
export type AiSourceAttributionV1 = Readonly<{
  /** Human-readable label for the source. */
  label: string;
  /** Optional: URI to the source material. */
  uri?: string;
  /** How relevant this source was to the conclusion (0..1). */
  relevance: number;
}>;

/**
 * An AI explanation block shows how an AI model arrived at its
 * recommendation or summary for an approval decision.
 *
 * This block implements the "policy is explainable" requirement
 * from the Universal Decision Surface epic.
 */
export type AiExplanationBlock = Readonly<{
  blockType: 'aiExplanation';
  /** Human-readable title (e.g. "AI Summary", "Risk Assessment"). */
  title: string;
  /** The AI's recommendation or summary text. */
  summaryText: string;
  /** Confidence band for the recommendation. */
  confidence: AiConfidenceBand;
  /** Numeric confidence score (0..1). */
  confidenceScore: number;
  /** The reasoning chain the AI followed. */
  reasoningChain: readonly AiReasoningStepV1[];
  /** Sources the AI cited. */
  sources: readonly AiSourceAttributionV1[];
  /** Optional: caveats or limitations the AI flagged. */
  caveats: readonly string[];
  /** The AI model that produced this explanation. */
  modelId: string;
}>;

// ---------------------------------------------------------------------------
// Extended block union
// ---------------------------------------------------------------------------

/** All extended block types. */
export type ExtendedPresentationBlock =
  | DiffBlock
  | ComparisonBlock
  | PreviewBlock
  | AiExplanationBlock;

/** Full union of base + extended block types. */
export type PresentationBlockV2 = BasePresentationBlock | ExtendedPresentationBlock;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isDiffBlock(b: PresentationBlockV2): b is DiffBlock {
  return b.blockType === 'diff';
}

export function isComparisonBlock(b: PresentationBlockV2): b is ComparisonBlock {
  return b.blockType === 'comparison';
}

export function isPreviewBlock(b: PresentationBlockV2): b is PreviewBlock {
  return b.blockType === 'preview';
}

export function isAiExplanationBlock(b: PresentationBlockV2): b is AiExplanationBlock {
  return b.blockType === 'aiExplanation';
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build a diff block from old and new text values.
 *
 * This is a simple line-level diff — for production use, integrate
 * a proper diff algorithm (Myers, patience, etc.).
 */
export function buildDiffBlock(params: {
  label: string;
  oldLabel: string;
  newLabel: string;
  oldText: string;
  newText: string;
  displayMode?: DiffDisplayMode;
}): DiffBlock {
  const oldLines = params.oldText.split('\n');
  const newLines = params.newText.split('\n');
  const { hunks, additions, deletions, unchanged } = computeSimpleDiff(oldLines, newLines);

  return deepFreeze({
    blockType: 'diff' as const,
    label: params.label,
    oldLabel: params.oldLabel,
    newLabel: params.newLabel,
    displayMode: params.displayMode ?? 'unified',
    hunks,
    stats: { additions, deletions, unchanged },
  });
}

/**
 * Build a comparison block from before/after field maps.
 */
export function buildComparisonBlock(params: {
  title: string;
  oldFields: Readonly<Record<string, string>>;
  newFields: Readonly<Record<string, string>>;
}): ComparisonBlock {
  const allKeys = new Set([...Object.keys(params.oldFields), ...Object.keys(params.newFields)]);
  const fields: ComparisonFieldV1[] = [];
  let changedCount = 0;
  let unchangedCount = 0;

  for (const key of [...allKeys].sort()) {
    const oldVal = params.oldFields[key];
    const newVal = params.newFields[key];
    const changed = oldVal !== newVal;

    if (changed) {
      changedCount++;
    } else {
      unchangedCount++;
    }

    fields.push({
      label: key,
      ...(oldVal !== undefined ? { oldValue: oldVal } : {}),
      ...(newVal !== undefined ? { newValue: newVal } : {}),
      changed,
    });
  }

  return deepFreeze({
    blockType: 'comparison' as const,
    title: params.title,
    fields,
    changedCount,
    unchangedCount,
  });
}

/**
 * Build a preview block for an external resource.
 */
export function buildPreviewBlock(params: {
  label: string;
  uri: string;
  contentType: string;
  previewKind?: PreviewKind;
  sizeBytes?: number;
  sha256?: string;
  altText?: string;
}): PreviewBlock {
  const previewKind = params.previewKind ?? inferPreviewKind(params.contentType);

  return deepFreeze({
    blockType: 'preview' as const,
    label: params.label,
    uri: params.uri,
    contentType: params.contentType,
    previewKind,
    ...(params.sizeBytes !== undefined ? { sizeBytes: params.sizeBytes } : {}),
    ...(params.sha256 !== undefined ? { sha256: params.sha256 } : {}),
    ...(params.altText !== undefined ? { altText: params.altText } : {}),
  });
}

/**
 * Build an AI explanation block.
 */
export function buildAiExplanationBlock(params: {
  title: string;
  summaryText: string;
  confidence: AiConfidenceBand;
  confidenceScore: number;
  reasoningChain: readonly AiReasoningStepV1[];
  sources: readonly AiSourceAttributionV1[];
  caveats?: readonly string[];
  modelId: string;
}): AiExplanationBlock {
  if (params.confidenceScore < 0 || params.confidenceScore > 1) {
    throw new Error(
      `confidenceScore must be between 0 and 1, got ${String(params.confidenceScore)}`,
    );
  }

  return deepFreeze({
    blockType: 'aiExplanation' as const,
    title: params.title,
    summaryText: params.summaryText,
    confidence: params.confidence,
    confidenceScore: params.confidenceScore,
    reasoningChain: [...params.reasoningChain],
    sources: [...params.sources],
    caveats: [...(params.caveats ?? [])],
    modelId: params.modelId,
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Simple line-level diff: marks all old lines as removed and all new lines
 * as added when they differ.  For identical files, all lines are context.
 *
 * This is a naive O(n+m) diff — suitable for small payloads.  Production
 * systems should use a proper LCS-based algorithm.
 */
function computeSimpleDiff(
  oldLines: string[],
  newLines: string[],
): {
  hunks: DiffHunkV1[];
  additions: number;
  deletions: number;
  unchanged: number;
} {
  // If both are identical, return a single context hunk
  if (oldLines.join('\n') === newLines.join('\n')) {
    const lines: DiffLineV1[] = oldLines.map((content, i) => ({
      op: 'context' as const,
      content,
      oldLineNumber: i + 1,
      newLineNumber: i + 1,
    }));
    return {
      hunks:
        lines.length > 0
          ? [
              {
                oldStart: 1,
                oldCount: oldLines.length,
                newStart: 1,
                newCount: newLines.length,
                lines,
              },
            ]
          : [],
      additions: 0,
      deletions: 0,
      unchanged: oldLines.length,
    };
  }

  // Naive diff: emit all old lines as removed, all new lines as added
  const lines: DiffLineV1[] = [];
  let deletions = 0;
  let additions = 0;

  for (let i = 0; i < oldLines.length; i++) {
    lines.push({ op: 'remove', content: oldLines[i]!, oldLineNumber: i + 1 });
    deletions++;
  }
  for (let i = 0; i < newLines.length; i++) {
    lines.push({ op: 'add', content: newLines[i]!, newLineNumber: i + 1 });
    additions++;
  }

  const hunk: DiffHunkV1 = {
    oldStart: 1,
    oldCount: oldLines.length,
    newStart: 1,
    newCount: newLines.length,
    lines,
  };

  return { hunks: [hunk], additions, deletions, unchanged: 0 };
}

function inferPreviewKind(contentType: string): PreviewKind {
  const ct = contentType.toLowerCase();
  if (ct.startsWith('image/')) return 'image';
  if (ct === 'application/json') return 'json';
  if (ct === 'text/markdown') return 'markdown';
  if (ct === 'application/pdf' || ct.includes('document')) return 'document';
  if (ct === 'text/csv' || ct.includes('spreadsheet')) return 'table';
  return 'unknown';
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const child = (obj as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return obj;
}
