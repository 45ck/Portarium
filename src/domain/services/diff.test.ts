import { describe, expect, it } from 'vitest';

import { EffectId } from '../primitives/index.js';
import type { PortFamily } from '../primitives/index.js';
import type { ExternalObjectRef } from '../canonical/external-object-ref.js';
import type { PlannedEffectV1 } from '../plan/plan-v1.js';

import { diffEffects, type VerifiedEffectV1 } from './diff.js';

const makeRef = (): ExternalObjectRef => ({
  sorName: 'test-sor',
  portFamily: 'FinanceAccounting' as PortFamily,
  externalId: 'ext-1',
  externalType: 'Invoice',
});

const makePlanned = (id: string, op: PlannedEffectV1['operation'] = 'Create'): PlannedEffectV1 => ({
  effectId: EffectId(id),
  operation: op,
  target: makeRef(),
  summary: `Test effect ${id}`,
});

const makeVerified = (
  id: string,
  op: PlannedEffectV1['operation'] = 'Create',
): VerifiedEffectV1 => ({
  effectId: EffectId(id),
  operation: op,
  target: makeRef(),
  summary: `Verified effect ${id}`,
  verifiedAtIso: '2026-02-17T00:00:00Z',
});

describe('diffEffects', () => {
  it('returns clean diff when planned and verified match exactly', () => {
    const result = diffEffects({
      planned: [makePlanned('e-1'), makePlanned('e-2')],
      verified: [makeVerified('e-1'), makeVerified('e-2')],
    });

    expect(result.matchedCount).toBe(2);
    expect(result.missingCount).toBe(0);
    expect(result.unexpectedCount).toBe(0);
    expect(result.mismatchCount).toBe(0);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((e) => e.status === 'Matched')).toBe(true);
  });

  it('returns Missing for planned effects without verified', () => {
    const result = diffEffects({
      planned: [makePlanned('e-1'), makePlanned('e-2')],
      verified: [makeVerified('e-1')],
    });

    const missing = result.entries.find((e) => e.status === 'Missing');
    expect(missing).toBeDefined();
    expect(String(missing!.effectId)).toBe('e-2');
    expect(missing!.planned).toBeDefined();
    expect(missing!.verified).toBeUndefined();
    expect(result.missingCount).toBe(1);
  });

  it('returns Unexpected for verified effects without planned', () => {
    const result = diffEffects({
      planned: [makePlanned('e-1')],
      verified: [makeVerified('e-1'), makeVerified('e-extra')],
    });

    const unexpected = result.entries.find((e) => e.status === 'Unexpected');
    expect(unexpected).toBeDefined();
    expect(String(unexpected!.effectId)).toBe('e-extra');
    expect(unexpected!.verified).toBeDefined();
    expect(unexpected!.planned).toBeUndefined();
    expect(result.unexpectedCount).toBe(1);
  });

  it('returns OperationMismatch when operations differ', () => {
    const result = diffEffects({
      planned: [makePlanned('e-1', 'Create')],
      verified: [makeVerified('e-1', 'Update')],
    });

    const mismatch = result.entries.find((e) => e.status === 'OperationMismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch!.planned!.operation).toBe('Create');
    expect(mismatch!.verified!.operation).toBe('Update');
    expect(result.mismatchCount).toBe(1);
  });

  it('returns isClean = true for perfect match', () => {
    const result = diffEffects({
      planned: [makePlanned('e-1')],
      verified: [makeVerified('e-1')],
    });

    expect(result.isClean).toBe(true);
  });

  it('returns isClean = false for any discrepancy', () => {
    const missingResult = diffEffects({
      planned: [makePlanned('e-1')],
      verified: [],
    });
    expect(missingResult.isClean).toBe(false);

    const unexpectedResult = diffEffects({
      planned: [],
      verified: [makeVerified('e-1')],
    });
    expect(unexpectedResult.isClean).toBe(false);

    const mismatchResult = diffEffects({
      planned: [makePlanned('e-1', 'Create')],
      verified: [makeVerified('e-1', 'Delete')],
    });
    expect(mismatchResult.isClean).toBe(false);
  });

  it('handles empty planned array', () => {
    const result = diffEffects({
      planned: [],
      verified: [makeVerified('e-1')],
    });

    expect(result.matchedCount).toBe(0);
    expect(result.unexpectedCount).toBe(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.status).toBe('Unexpected');
  });

  it('handles empty verified array', () => {
    const result = diffEffects({
      planned: [makePlanned('e-1')],
      verified: [],
    });

    expect(result.matchedCount).toBe(0);
    expect(result.missingCount).toBe(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.status).toBe('Missing');
  });

  it('handles both empty arrays', () => {
    const result = diffEffects({
      planned: [],
      verified: [],
    });

    expect(result.entries).toHaveLength(0);
    expect(result.matchedCount).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.unexpectedCount).toBe(0);
    expect(result.mismatchCount).toBe(0);
    expect(result.isClean).toBe(true);
  });
});
