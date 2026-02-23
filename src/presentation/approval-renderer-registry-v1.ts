/**
 * Renderer registry for domain-specific approval views (bead-h575).
 *
 * Provides a typed, extensible registry that maps `PresentationBlock` types
 * from the evidence presentation DSL to concrete renderers.
 *
 * The registry is parameterized by output type `TOutput`, allowing the same
 * block DSL to drive different rendering targets (HTML strings, React nodes,
 * PDF elements, CLI text, etc.) by wiring different renderer sets.
 *
 * Usage:
 *   const registry = createRendererRegistry<string>();
 *   registry.register({ blockType: 'header', render: (b) => `<h1>${b.text}</h1>` });
 *   const output = registry.render(someBlock);
 */

import type { PresentationBlock } from '../domain/evidence/presentation-blocks-v1.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A renderer for a specific block type.
 *
 * `TBlock` is the concrete block type (e.g., `HeaderBlock`).
 * `TOutput` is the render output type (e.g., `string`, `ReactNode`).
 */
export interface BlockRenderer<
  TBlock extends PresentationBlock = PresentationBlock,
  TOutput = unknown,
> {
  readonly blockType: TBlock['blockType'];
  render(block: TBlock): TOutput;
}

/**
 * A registry that maps block types to their renderers and dispatches
 * rendering based on block type.
 */
export interface RendererRegistry<TOutput> {
  /** Register a renderer for a specific block type. Throws if already registered. */
  register(renderer: BlockRenderer<any, TOutput>): void;

  /** Check if a renderer is registered for the given block type. */
  has(blockType: PresentationBlock['blockType']): boolean;

  /** Render a single block. Throws if no renderer is registered for its type. */
  render(block: PresentationBlock): TOutput;

  /** Render an ordered list of blocks. Throws on first unregistered type. */
  renderAll(blocks: readonly PresentationBlock[]): TOutput[];

  /** Return the list of currently registered block types. */
  registeredBlockTypes(): PresentationBlock['blockType'][];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RendererNotRegisteredError extends Error {
  public override readonly name = 'RendererNotRegisteredError';
  public readonly blockType: string;

  public constructor(blockType: string) {
    super(`No renderer registered for block type: ${blockType}`);
    this.blockType = blockType;
  }
}

export class DuplicateRendererError extends Error {
  public override readonly name = 'DuplicateRendererError';
  public readonly blockType: string;

  public constructor(blockType: string) {
    super(`Renderer already registered for block type: ${blockType}`);
    this.blockType = blockType;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new, empty renderer registry parameterized by output type.
 *
 * Register block renderers via `.register()`, then call `.render()` or
 * `.renderAll()` to dispatch rendering.
 */
export function createRendererRegistry<TOutput>(): RendererRegistry<TOutput> {
  const renderers = new Map<string, BlockRenderer<any, TOutput>>();

  return {
    register(renderer: BlockRenderer<any, TOutput>): void {
      if (renderers.has(renderer.blockType)) {
        throw new DuplicateRendererError(renderer.blockType);
      }
      renderers.set(renderer.blockType, renderer);
    },

    has(blockType: PresentationBlock['blockType']): boolean {
      return renderers.has(blockType);
    },

    render(block: PresentationBlock): TOutput {
      const renderer = renderers.get(block.blockType);
      if (!renderer) {
        throw new RendererNotRegisteredError(block.blockType);
      }
      return renderer.render(block);
    },

    renderAll(blocks: readonly PresentationBlock[]): TOutput[] {
      return blocks.map((block) => {
        const renderer = renderers.get(block.blockType);
        if (!renderer) {
          throw new RendererNotRegisteredError(block.blockType);
        }
        return renderer.render(block);
      });
    },

    registeredBlockTypes(): PresentationBlock['blockType'][] {
      return [...renderers.keys()] as PresentationBlock['blockType'][];
    },
  };
}
