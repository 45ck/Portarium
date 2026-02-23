import { describe, expect, it } from 'vitest';

import {
  buildAiExplanationBlock,
  buildComparisonBlock,
  buildDiffBlock,
  buildPreviewBlock,
  isAiExplanationBlock,
  isComparisonBlock,
  isDiffBlock,
  isPreviewBlock,
  type PresentationBlockV2,
} from './presentation-blocks-extended-v1.js';

// ---------------------------------------------------------------------------
// buildDiffBlock
// ---------------------------------------------------------------------------

describe('buildDiffBlock', () => {
  it('builds a diff between two text values', () => {
    const block = buildDiffBlock({
      label: 'Config change',
      oldLabel: 'v1.0',
      newLabel: 'v1.1',
      oldText: 'line1\nline2',
      newText: 'line1\nline3',
    });

    expect(block.blockType).toBe('diff');
    expect(block.label).toBe('Config change');
    expect(block.oldLabel).toBe('v1.0');
    expect(block.newLabel).toBe('v1.1');
    expect(block.displayMode).toBe('unified');
    expect(block.hunks.length).toBeGreaterThan(0);
    expect(block.stats.additions).toBeGreaterThan(0);
    expect(block.stats.deletions).toBeGreaterThan(0);
  });

  it('shows all context lines for identical text', () => {
    const block = buildDiffBlock({
      label: 'No change',
      oldLabel: 'a',
      newLabel: 'b',
      oldText: 'same\ncontent',
      newText: 'same\ncontent',
    });

    expect(block.stats.additions).toBe(0);
    expect(block.stats.deletions).toBe(0);
    expect(block.stats.unchanged).toBe(2);
    expect(block.hunks).toHaveLength(1);
    expect(block.hunks[0]!.lines.every((l) => l.op === 'context')).toBe(true);
  });

  it('handles empty old text (full addition)', () => {
    const block = buildDiffBlock({
      label: 'New file',
      oldLabel: 'empty',
      newLabel: 'created',
      oldText: '',
      newText: 'line1\nline2',
    });

    expect(block.stats.additions).toBe(2);
    // The empty old text has 1 empty line that gets removed
    expect(block.stats.deletions).toBe(1);
  });

  it('respects sideBySide display mode', () => {
    const block = buildDiffBlock({
      label: 'test',
      oldLabel: 'a',
      newLabel: 'b',
      oldText: 'old',
      newText: 'new',
      displayMode: 'sideBySide',
    });

    expect(block.displayMode).toBe('sideBySide');
  });

  it('returns frozen block', () => {
    const block = buildDiffBlock({
      label: 'test',
      oldLabel: 'a',
      newLabel: 'b',
      oldText: 'old',
      newText: 'new',
    });

    expect(Object.isFrozen(block)).toBe(true);
    expect(Object.isFrozen(block.hunks)).toBe(true);
    expect(Object.isFrozen(block.stats)).toBe(true);
  });

  it('assigns line numbers to diff lines', () => {
    const block = buildDiffBlock({
      label: 'test',
      oldLabel: 'a',
      newLabel: 'b',
      oldText: 'old line',
      newText: 'new line',
    });

    const removals = block.hunks[0]!.lines.filter((l) => l.op === 'remove');
    const additions = block.hunks[0]!.lines.filter((l) => l.op === 'add');

    expect(removals[0]!.oldLineNumber).toBe(1);
    expect(additions[0]!.newLineNumber).toBe(1);
  });

  it('handles empty diff (both empty)', () => {
    const block = buildDiffBlock({
      label: 'empty',
      oldLabel: 'a',
      newLabel: 'b',
      oldText: '',
      newText: '',
    });

    expect(block.stats.unchanged).toBe(1); // single empty line
  });
});

// ---------------------------------------------------------------------------
// buildComparisonBlock
// ---------------------------------------------------------------------------

describe('buildComparisonBlock', () => {
  it('compares before/after field maps', () => {
    const block = buildComparisonBlock({
      title: 'Permission change',
      oldFields: { role: 'viewer', status: 'active' },
      newFields: { role: 'editor', status: 'active' },
    });

    expect(block.blockType).toBe('comparison');
    expect(block.title).toBe('Permission change');
    expect(block.changedCount).toBe(1);
    expect(block.unchangedCount).toBe(1);
    expect(block.fields).toHaveLength(2);
  });

  it('marks added fields correctly', () => {
    const block = buildComparisonBlock({
      title: 'Field added',
      oldFields: {},
      newFields: { newField: 'value' },
    });

    expect(block.fields).toHaveLength(1);
    const field = block.fields[0]!;
    expect(field.label).toBe('newField');
    expect(field.oldValue).toBeUndefined();
    expect(field.newValue).toBe('value');
    expect(field.changed).toBe(true);
  });

  it('marks removed fields correctly', () => {
    const block = buildComparisonBlock({
      title: 'Field removed',
      oldFields: { gone: 'was here' },
      newFields: {},
    });

    const field = block.fields[0]!;
    expect(field.oldValue).toBe('was here');
    expect(field.newValue).toBeUndefined();
    expect(field.changed).toBe(true);
  });

  it('sorts fields alphabetically', () => {
    const block = buildComparisonBlock({
      title: 'Sorted',
      oldFields: { z: '1', a: '2' },
      newFields: { z: '1', a: '2' },
    });

    expect(block.fields[0]!.label).toBe('a');
    expect(block.fields[1]!.label).toBe('z');
  });

  it('returns frozen block', () => {
    const block = buildComparisonBlock({
      title: 'test',
      oldFields: { a: '1' },
      newFields: { a: '2' },
    });

    expect(Object.isFrozen(block)).toBe(true);
    expect(Object.isFrozen(block.fields)).toBe(true);
  });

  it('handles empty field maps', () => {
    const block = buildComparisonBlock({
      title: 'Empty',
      oldFields: {},
      newFields: {},
    });

    expect(block.fields).toHaveLength(0);
    expect(block.changedCount).toBe(0);
    expect(block.unchangedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildPreviewBlock
// ---------------------------------------------------------------------------

describe('buildPreviewBlock', () => {
  it('builds a preview with explicit kind', () => {
    const block = buildPreviewBlock({
      label: 'Invoice PDF',
      uri: 'https://storage.example.com/invoice.pdf',
      contentType: 'application/pdf',
      previewKind: 'document',
    });

    expect(block.blockType).toBe('preview');
    expect(block.label).toBe('Invoice PDF');
    expect(block.previewKind).toBe('document');
  });

  it('infers image preview kind from content type', () => {
    const block = buildPreviewBlock({
      label: 'Screenshot',
      uri: 'https://cdn.example.com/shot.png',
      contentType: 'image/png',
    });

    expect(block.previewKind).toBe('image');
  });

  it('infers json preview kind', () => {
    const block = buildPreviewBlock({
      label: 'API response',
      uri: 'https://api.example.com/data.json',
      contentType: 'application/json',
    });

    expect(block.previewKind).toBe('json');
  });

  it('infers markdown preview kind', () => {
    const block = buildPreviewBlock({
      label: 'README',
      uri: 'https://repo.example.com/README.md',
      contentType: 'text/markdown',
    });

    expect(block.previewKind).toBe('markdown');
  });

  it('infers table preview kind from csv', () => {
    const block = buildPreviewBlock({
      label: 'Data',
      uri: 'https://data.example.com/report.csv',
      contentType: 'text/csv',
    });

    expect(block.previewKind).toBe('table');
  });

  it('falls back to unknown for unrecognized content type', () => {
    const block = buildPreviewBlock({
      label: 'Binary',
      uri: 'https://example.com/blob',
      contentType: 'application/octet-stream',
    });

    expect(block.previewKind).toBe('unknown');
  });

  it('includes optional fields when provided', () => {
    const block = buildPreviewBlock({
      label: 'Doc',
      uri: 'https://example.com/doc.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      sha256: 'abc123',
      altText: 'Invoice document',
    });

    expect(block.sizeBytes).toBe(1024);
    expect(block.sha256).toBe('abc123');
    expect(block.altText).toBe('Invoice document');
  });

  it('omits optional fields when not provided', () => {
    const block = buildPreviewBlock({
      label: 'Doc',
      uri: 'https://example.com/doc.pdf',
      contentType: 'application/pdf',
    });

    expect('sizeBytes' in block).toBe(false);
    expect('sha256' in block).toBe(false);
    expect('altText' in block).toBe(false);
  });

  it('returns frozen block', () => {
    const block = buildPreviewBlock({
      label: 'test',
      uri: 'https://example.com/test',
      contentType: 'text/plain',
    });

    expect(Object.isFrozen(block)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildAiExplanationBlock
// ---------------------------------------------------------------------------

describe('buildAiExplanationBlock', () => {
  it('builds a complete AI explanation block', () => {
    const block = buildAiExplanationBlock({
      title: 'Risk Assessment',
      summaryText: 'This deployment carries medium risk.',
      confidence: 'medium',
      confidenceScore: 0.65,
      reasoningChain: [
        { stepNumber: 1, description: 'Analyzed change scope', basis: '3 files modified' },
        { stepNumber: 2, description: 'Checked test coverage', basis: '92% coverage' },
      ],
      sources: [{ label: 'Test report', uri: 'https://ci.example.com/report', relevance: 0.9 }],
      caveats: ['Limited historical data available'],
      modelId: 'claude-sonnet-4-6',
    });

    expect(block.blockType).toBe('aiExplanation');
    expect(block.title).toBe('Risk Assessment');
    expect(block.confidence).toBe('medium');
    expect(block.confidenceScore).toBe(0.65);
    expect(block.reasoningChain).toHaveLength(2);
    expect(block.sources).toHaveLength(1);
    expect(block.caveats).toHaveLength(1);
    expect(block.modelId).toBe('claude-sonnet-4-6');
  });

  it('defaults caveats to empty array', () => {
    const block = buildAiExplanationBlock({
      title: 'Summary',
      summaryText: 'All good.',
      confidence: 'high',
      confidenceScore: 0.95,
      reasoningChain: [],
      sources: [],
      modelId: 'test-model',
    });

    expect(block.caveats).toEqual([]);
  });

  it('throws for confidence score below 0', () => {
    expect(() =>
      buildAiExplanationBlock({
        title: 'Bad',
        summaryText: 'test',
        confidence: 'low',
        confidenceScore: -0.1,
        reasoningChain: [],
        sources: [],
        modelId: 'test',
      }),
    ).toThrow('confidenceScore must be between 0 and 1');
  });

  it('throws for confidence score above 1', () => {
    expect(() =>
      buildAiExplanationBlock({
        title: 'Bad',
        summaryText: 'test',
        confidence: 'high',
        confidenceScore: 1.5,
        reasoningChain: [],
        sources: [],
        modelId: 'test',
      }),
    ).toThrow('confidenceScore must be between 0 and 1');
  });

  it('accepts boundary confidence scores (0 and 1)', () => {
    const blockZero = buildAiExplanationBlock({
      title: 'Zero',
      summaryText: 'test',
      confidence: 'insufficient_data',
      confidenceScore: 0,
      reasoningChain: [],
      sources: [],
      modelId: 'test',
    });
    expect(blockZero.confidenceScore).toBe(0);

    const blockOne = buildAiExplanationBlock({
      title: 'One',
      summaryText: 'test',
      confidence: 'high',
      confidenceScore: 1,
      reasoningChain: [],
      sources: [],
      modelId: 'test',
    });
    expect(blockOne.confidenceScore).toBe(1);
  });

  it('returns frozen block with frozen nested arrays', () => {
    const block = buildAiExplanationBlock({
      title: 'test',
      summaryText: 'test',
      confidence: 'medium',
      confidenceScore: 0.5,
      reasoningChain: [{ stepNumber: 1, description: 'step' }],
      sources: [{ label: 'src', relevance: 0.8 }],
      caveats: ['caveat'],
      modelId: 'test',
    });

    expect(Object.isFrozen(block)).toBe(true);
    expect(Object.isFrozen(block.reasoningChain)).toBe(true);
    expect(Object.isFrozen(block.sources)).toBe(true);
    expect(Object.isFrozen(block.caveats)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

describe('type guards', () => {
  const diffBlock: PresentationBlockV2 = buildDiffBlock({
    label: 'test',
    oldLabel: 'a',
    newLabel: 'b',
    oldText: 'old',
    newText: 'new',
  });

  const compBlock: PresentationBlockV2 = buildComparisonBlock({
    title: 'test',
    oldFields: { a: '1' },
    newFields: { a: '2' },
  });

  const prevBlock: PresentationBlockV2 = buildPreviewBlock({
    label: 'test',
    uri: 'https://example.com',
    contentType: 'text/plain',
  });

  const aiBlock: PresentationBlockV2 = buildAiExplanationBlock({
    title: 'test',
    summaryText: 'test',
    confidence: 'high',
    confidenceScore: 0.9,
    reasoningChain: [],
    sources: [],
    modelId: 'test',
  });

  it('isDiffBlock identifies diff blocks', () => {
    expect(isDiffBlock(diffBlock)).toBe(true);
    expect(isDiffBlock(compBlock)).toBe(false);
  });

  it('isComparisonBlock identifies comparison blocks', () => {
    expect(isComparisonBlock(compBlock)).toBe(true);
    expect(isComparisonBlock(diffBlock)).toBe(false);
  });

  it('isPreviewBlock identifies preview blocks', () => {
    expect(isPreviewBlock(prevBlock)).toBe(true);
    expect(isPreviewBlock(aiBlock)).toBe(false);
  });

  it('isAiExplanationBlock identifies AI explanation blocks', () => {
    expect(isAiExplanationBlock(aiBlock)).toBe(true);
    expect(isAiExplanationBlock(prevBlock)).toBe(false);
  });
});
