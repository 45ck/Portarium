import { describe, expect, it } from 'vitest';

import { parseRetentionScheduleV1 } from './retention-schedule-v1.js';

describe('parseRetentionScheduleV1: happy path', () => {
  it('parses a RetentionScheduleV1 with all fields', () => {
    const schedule = parseRetentionScheduleV1({
      retentionClass: 'Compliance',
      retainUntilIso: '2030-12-31T23:59:59.000Z',
      legalHold: true,
    });

    expect(schedule.retentionClass).toBe('Compliance');
    expect(schedule.retainUntilIso).toBe('2030-12-31T23:59:59.000Z');
    expect(schedule.legalHold).toBe(true);
  });

  it('parses a RetentionScheduleV1 with minimal fields (just retentionClass)', () => {
    const schedule = parseRetentionScheduleV1({
      retentionClass: 'Operational',
    });

    expect(schedule.retentionClass).toBe('Operational');
    expect(schedule.retainUntilIso).toBeUndefined();
    expect(schedule.legalHold).toBeUndefined();
  });

  it('parses each valid retentionClass value', () => {
    for (const cls of ['Operational', 'Compliance', 'Forensic']) {
      const schedule = parseRetentionScheduleV1({ retentionClass: cls });
      expect(schedule.retentionClass).toBe(cls);
    }
  });

  it('accepts legalHold as false', () => {
    const schedule = parseRetentionScheduleV1({
      retentionClass: 'Forensic',
      legalHold: false,
    });

    expect(schedule.legalHold).toBe(false);
  });
});

describe('parseRetentionScheduleV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parseRetentionScheduleV1('nope')).toThrow(/must be an object/i);
    expect(() => parseRetentionScheduleV1(null)).toThrow(/must be an object/i);
    expect(() => parseRetentionScheduleV1(42)).toThrow(/must be an object/i);
  });

  it('rejects invalid retentionClass', () => {
    expect(() => parseRetentionScheduleV1({ retentionClass: 'Archive' })).toThrow(
      /retentionClass/i,
    );
  });

  it('rejects missing retentionClass', () => {
    expect(() => parseRetentionScheduleV1({})).toThrow(/retentionClass/i);
  });

  it('rejects non-boolean legalHold', () => {
    expect(() =>
      parseRetentionScheduleV1({ retentionClass: 'Operational', legalHold: 'yes' }),
    ).toThrow(/legalHold.*boolean/i);

    expect(() => parseRetentionScheduleV1({ retentionClass: 'Operational', legalHold: 1 })).toThrow(
      /legalHold.*boolean/i,
    );
  });

  it('rejects invalid retainUntilIso', () => {
    expect(() =>
      parseRetentionScheduleV1({ retentionClass: 'Compliance', retainUntilIso: '' }),
    ).toThrow(/retainUntilIso/i);

    expect(() =>
      parseRetentionScheduleV1({ retentionClass: 'Compliance', retainUntilIso: 123 }),
    ).toThrow(/retainUntilIso/i);
  });
});
