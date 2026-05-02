import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_POSTURE_ROWS,
  applyCapabilityPosturePreset,
  resolveEffectiveCapabilityPosture,
  summarizeEffectivePostures,
} from '@/lib/capability-posture';

describe('capability posture model', () => {
  it('keeps balanced preset aligned to the published default before exceptions', () => {
    const row = CAPABILITY_POSTURE_ROWS.find((item) => item.id === 'external-communication')!;
    const posture = applyCapabilityPosturePreset(row, 'balanced');

    expect(posture.tier).toBe(row.defaultPosture.tier);
    expect(posture.roles).toEqual(row.defaultPosture.roles);
    expect(posture.evidence).toEqual(row.defaultPosture.evidence);
  });

  it('merges conservative preset evidence without dropping existing evidence gates', () => {
    const row = CAPABILITY_POSTURE_ROWS.find((item) => item.id === 'money-movement')!;
    const posture = applyCapabilityPosturePreset(row, 'conservative');

    expect(posture.tier).toBe('ManualOnly');
    expect(posture.evidence).toEqual(
      expect.arrayContaining(['Diff artifact', 'Recipient or target list', 'Rollback plan']),
    );
  });

  it('raises effective posture when a visible exception is stricter than the preset', () => {
    const row = CAPABILITY_POSTURE_ROWS.find((item) => item.id === 'money-movement')!;
    const effective = resolveEffectiveCapabilityPosture(row, 'balanced');

    expect(effective.posture.tier).toBe('ManualOnly');
    expect(effective.strongestException?.label).toBe('High-value transfer exception');
    expect(effective.explanation).toContain('strongest visible exception');
  });

  it('summarizes effective tier counts under a selected preset', () => {
    const summary = summarizeEffectivePostures(CAPABILITY_POSTURE_ROWS, 'balanced');

    expect(summary.Auto).toBe(0);
    expect(summary.Assisted).toBe(1);
    expect(summary.HumanApprove).toBe(1);
    expect(summary.ManualOnly).toBe(3);
  });
});
