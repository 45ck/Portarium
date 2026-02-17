import type { PlannedEffectV1, EffectOperation } from '../plan/plan-v1.js';
import type { ExternalObjectRef } from '../canonical/external-object-ref.js';
import type { EffectId as EffectIdType } from '../primitives/index.js';

export type VerifiedEffectV1 = Readonly<{
  effectId: EffectIdType;
  operation: EffectOperation;
  target: ExternalObjectRef;
  summary: string;
  verifiedAtIso: string;
}>;

export type EffectDiffStatus = 'Matched' | 'Missing' | 'Unexpected' | 'OperationMismatch';

export type EffectDiffEntryV1 = Readonly<{
  effectId: EffectIdType;
  status: EffectDiffStatus;
  planned?: PlannedEffectV1;
  verified?: VerifiedEffectV1;
}>;

export type EffectDiffResultV1 = Readonly<{
  entries: readonly EffectDiffEntryV1[];
  matchedCount: number;
  missingCount: number;
  unexpectedCount: number;
  mismatchCount: number;
  isClean: boolean;
}>;

export function diffEffects(params: {
  planned: readonly PlannedEffectV1[];
  verified: readonly VerifiedEffectV1[];
}): EffectDiffResultV1 {
  const { planned, verified } = params;

  const verifiedByEffectId = new Map<string, VerifiedEffectV1>();
  for (const v of verified) {
    verifiedByEffectId.set(String(v.effectId), v);
  }

  const seenVerifiedIds = new Set<string>();
  const entries: EffectDiffEntryV1[] = [];

  for (const p of planned) {
    const key = String(p.effectId);
    const v = verifiedByEffectId.get(key);

    if (!v) {
      entries.push({ effectId: p.effectId, status: 'Missing', planned: p });
    } else if (v.operation !== p.operation) {
      seenVerifiedIds.add(key);
      entries.push({ effectId: p.effectId, status: 'OperationMismatch', planned: p, verified: v });
    } else {
      seenVerifiedIds.add(key);
      entries.push({ effectId: p.effectId, status: 'Matched', planned: p, verified: v });
    }
  }

  for (const v of verified) {
    const key = String(v.effectId);
    if (!seenVerifiedIds.has(key)) {
      entries.push({ effectId: v.effectId, status: 'Unexpected', verified: v });
    }
  }

  const matchedCount = entries.filter((e) => e.status === 'Matched').length;
  const missingCount = entries.filter((e) => e.status === 'Missing').length;
  const unexpectedCount = entries.filter((e) => e.status === 'Unexpected').length;
  const mismatchCount = entries.filter((e) => e.status === 'OperationMismatch').length;

  return {
    entries,
    matchedCount,
    missingCount,
    unexpectedCount,
    mismatchCount,
    isClean: missingCount === 0 && unexpectedCount === 0 && mismatchCount === 0,
  };
}
