import { describe, it, expect } from 'vitest';
import {
  createRendererRegistry,
  type BlockRenderer,
  RendererNotRegisteredError,
  DuplicateRendererError,
} from './approval-renderer-registry-v1.js';
import type {
  HeaderBlock,
  MetadataBlock,
  SummaryBlock,
  SeparatorBlock,
  PresentationBlock,
} from '../domain/evidence/presentation-blocks-v1.js';

// ---------------------------------------------------------------------------
// Stub renderers for testing
// ---------------------------------------------------------------------------

type StringOutput = string;

const headerRenderer: BlockRenderer<HeaderBlock, StringOutput> = {
  blockType: 'header',
  render(block) {
    return `<h${String(block.level)}>${block.text}</h${String(block.level)}>`;
  },
};

const metadataRenderer: BlockRenderer<MetadataBlock, StringOutput> = {
  blockType: 'metadata',
  render(block) {
    return block.fields.map((f) => `${f.label}: ${f.value}`).join(', ');
  },
};

const summaryRenderer: BlockRenderer<SummaryBlock, StringOutput> = {
  blockType: 'summary',
  render(block) {
    return `[${block.severity}] ${block.text}`;
  },
};

const separatorRenderer: BlockRenderer<SeparatorBlock, StringOutput> = {
  blockType: 'separator',
  render() {
    return '---';
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RendererRegistry', () => {
  it('creates an empty registry', () => {
    const registry = createRendererRegistry<StringOutput>();
    expect(registry.registeredBlockTypes()).toEqual([]);
  });

  it('registers and retrieves a renderer', () => {
    const registry = createRendererRegistry<StringOutput>();
    registry.register(headerRenderer);

    expect(registry.has('header')).toBe(true);
    expect(registry.registeredBlockTypes()).toEqual(['header']);
  });

  it('renders a block using the registered renderer', () => {
    const registry = createRendererRegistry<StringOutput>();
    registry.register(headerRenderer);

    const block: HeaderBlock = { blockType: 'header', level: 1, text: 'Evidence Trail' };
    const result = registry.render(block);
    expect(result).toBe('<h1>Evidence Trail</h1>');
  });

  it('throws RendererNotRegisteredError for unregistered block type', () => {
    const registry = createRendererRegistry<StringOutput>();

    const block: HeaderBlock = { blockType: 'header', level: 1, text: 'Test' };
    expect(() => registry.render(block)).toThrow(RendererNotRegisteredError);
    expect(() => registry.render(block)).toThrow(/header/);
  });

  it('throws DuplicateRendererError when registering same block type twice', () => {
    const registry = createRendererRegistry<StringOutput>();
    registry.register(headerRenderer);

    expect(() => registry.register(headerRenderer)).toThrow(DuplicateRendererError);
    expect(() => registry.register(headerRenderer)).toThrow(/header/);
  });

  it('renders multiple block types correctly', () => {
    const registry = createRendererRegistry<StringOutput>();
    registry.register(headerRenderer);
    registry.register(metadataRenderer);
    registry.register(summaryRenderer);
    registry.register(separatorRenderer);

    expect(registry.registeredBlockTypes()).toHaveLength(4);

    const blocks: PresentationBlock[] = [
      { blockType: 'header', level: 1, text: 'Evidence Trail' },
      { blockType: 'metadata', fields: [{ label: 'Count', value: '3' }] },
      { blockType: 'separator' },
      { blockType: 'summary', text: 'All good', severity: 'info' },
    ];

    const results = blocks.map((b) => registry.render(b));
    expect(results).toEqual(['<h1>Evidence Trail</h1>', 'Count: 3', '---', '[info] All good']);
  });

  it('renderAll renders a full list of blocks', () => {
    const registry = createRendererRegistry<StringOutput>();
    registry.register(headerRenderer);
    registry.register(summaryRenderer);

    const blocks: PresentationBlock[] = [
      { blockType: 'header', level: 2, text: 'Section' },
      { blockType: 'summary', text: 'Done', severity: 'info' },
    ];

    const results = registry.renderAll(blocks);
    expect(results).toEqual(['<h2>Section</h2>', '[info] Done']);
  });

  it('renderAll throws on first unregistered block type', () => {
    const registry = createRendererRegistry<StringOutput>();
    registry.register(headerRenderer);

    const blocks: PresentationBlock[] = [
      { blockType: 'header', level: 1, text: 'Title' },
      { blockType: 'summary', text: 'Done', severity: 'info' },
    ];

    expect(() => registry.renderAll(blocks)).toThrow(RendererNotRegisteredError);
  });

  it('has returns false for unregistered block types', () => {
    const registry = createRendererRegistry<StringOutput>();
    expect(registry.has('header')).toBe(false);
    expect(registry.has('timeline')).toBe(false);
  });

  it('registry is parameterized by output type', () => {
    interface JsonOutput {
      html: string;
    }

    const jsonHeaderRenderer: BlockRenderer<HeaderBlock, JsonOutput> = {
      blockType: 'header',
      render(block) {
        return { html: `<h${String(block.level)}>${block.text}</h${String(block.level)}>` };
      },
    };

    const registry = createRendererRegistry<JsonOutput>();
    registry.register(jsonHeaderRenderer);

    const result = registry.render({ blockType: 'header', level: 1, text: 'Test' });
    expect(result).toEqual({ html: '<h1>Test</h1>' });
  });
});
