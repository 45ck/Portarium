/**
 * Shared chain verification for evidence entries.
 * Used by: evidence-chain-mode, signal-evaluators, risk-scoring, briefing-templates.
 */

export interface ChainEntry<T> {
  entry: T;
  chainValid: boolean | null;
}

interface ChainLike {
  previousHash?: string;
  hashSha256: string;
  occurredAtIso: string;
}

export function verifyChain<T extends ChainLike>(entries: T[]): ChainEntry<T>[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort(
    (a, b) => new Date(a.occurredAtIso).getTime() - new Date(b.occurredAtIso).getTime(),
  );

  return sorted.map((entry, i) => {
    if (i === 0) return { entry, chainValid: null };
    const prev = sorted[i - 1]!;
    const valid = entry.previousHash === prev.hashSha256;
    return { entry, chainValid: valid };
  });
}

export function hasChainBreak<T extends ChainLike>(entries: T[]): boolean {
  if (entries.length === 0) return false;
  const sorted = [...entries].sort(
    (a, b) => new Date(a.occurredAtIso).getTime() - new Date(b.occurredAtIso).getTime(),
  );
  return sorted.some((entry, i) => {
    if (i === 0) return false;
    return entry.previousHash !== sorted[i - 1]!.hashSha256;
  });
}
