import type { SemVer } from './semver.js';
import { compareSemVer, formatSemVer, parseSemVer } from './semver.js';

export type SemVerComparatorOp = '<' | '<=' | '=' | '>=' | '>';

export type SemVerComparator = Readonly<{
  op: SemVerComparatorOp;
  version: SemVer;
}>;

export type SemVerRange =
  | Readonly<{ kind: 'any' }>
  | Readonly<{ kind: 'all'; comparators: readonly SemVerComparator[] }>;

export class SemVerRangeParseError extends Error {
  public override readonly name = 'SemVerRangeParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseSemVerRange(input: string): SemVerRange {
  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '*') return { kind: 'any' };

  const tokens = trimmed.split(/\s+/).filter((t) => t !== '');
  const comparators = tokens.map(parseComparatorToken);
  return { kind: 'all', comparators };
}

function parseComparatorToken(token: string): SemVerComparator {
  const parsed =
    parseWithOp(token, '>=') ??
    parseWithOp(token, '<=') ??
    parseWithOp(token, '>') ??
    parseWithOp(token, '<') ??
    parseWithOp(token, '=') ??
    ({ op: '=', version: parseSemVer(token) } as const);

  return parsed;
}

function parseWithOp(token: string, op: SemVerComparatorOp): SemVerComparator | null {
  if (!token.startsWith(op)) return null;
  const versionRaw = token.slice(op.length);
  if (versionRaw.trim() === '') {
    throw new SemVerRangeParseError(`Invalid range comparator "${token}". Missing version.`);
  }
  return { op, version: parseSemVer(versionRaw) };
}

export function satisfiesSemVerRange(version: SemVer, range: SemVerRange): boolean {
  if (range.kind === 'any') return true;
  return range.comparators.every((c) => satisfiesComparator(version, c));
}

export function formatSemVerRange(range: SemVerRange): string {
  if (range.kind === 'any') return '*';
  return range.comparators
    .map((c) => (c.op === '=' ? formatSemVer(c.version) : `${c.op}${formatSemVer(c.version)}`))
    .join(' ');
}

function satisfiesComparator(version: SemVer, comparator: SemVerComparator): boolean {
  const cmp = compareSemVer(version, comparator.version);
  switch (comparator.op) {
    case '=':
      return cmp === 0;
    case '>':
      return cmp > 0;
    case '>=':
      return cmp >= 0;
    case '<':
      return cmp < 0;
    case '<=':
      return cmp <= 0;
  }
}
