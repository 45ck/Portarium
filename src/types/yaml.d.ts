/**
 * Minimal type declaration for the `yaml` package.
 *
 * The yaml@2.x package ships with bundled types, but the pnpm-linked
 * node_modules in this environment is missing dist/index.d.ts. This stub
 * provides the subset of the API used in this codebase.
 *
 * Remove this file once the pnpm package store is fully populated.
 */
declare module 'yaml' {
  export function parse(str: string, options?: Record<string, unknown>): unknown;
  export function stringify(value: unknown, options?: Record<string, unknown>): string;
  export function parseDocument(str: string, options?: Record<string, unknown>): unknown;
  export function parseAllDocuments(str: string, options?: Record<string, unknown>): unknown[];
  export function isDocument(value: unknown): boolean;
  export function isMap(value: unknown): boolean;
  export function isPair(value: unknown): boolean;
  export function isSeq(value: unknown): boolean;
  export function isScalar(value: unknown): boolean;
  export function isAlias(value: unknown): boolean;
  export function isNode(value: unknown): boolean;
  export class Document {
    contents: unknown;
    toString(): string;
  }
  export class YAMLError extends Error {}
  export class YAMLParseError extends YAMLError {}
  export class YAMLWarning extends YAMLError {}
}
