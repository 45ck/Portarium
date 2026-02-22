import { describe, expect, it } from 'vitest';

import {
  parseAssignHumanTaskBody,
  parseAvailabilityPatchBody,
  parseCompleteHumanTaskBody,
  parseEscalateHumanTaskBody,
} from './control-plane-handler.workforce-validation.js';

describe('parseAvailabilityPatchBody', () => {
  it('accepts valid availability statuses', () => {
    for (const status of ['available', 'busy', 'offline'] as const) {
      const result = parseAvailabilityPatchBody({ availabilityStatus: status });
      expect(result).toEqual({ ok: true, availabilityStatus: status });
    }
  });

  it('rejects null', () => {
    expect(parseAvailabilityPatchBody(null)).toEqual({ ok: false });
  });

  it('rejects non-object values', () => {
    expect(parseAvailabilityPatchBody('offline')).toEqual({ ok: false });
    expect(parseAvailabilityPatchBody(42)).toEqual({ ok: false });
  });

  it('rejects missing availabilityStatus field', () => {
    expect(parseAvailabilityPatchBody({})).toEqual({ ok: false });
  });

  it('rejects invalid availabilityStatus value', () => {
    expect(parseAvailabilityPatchBody({ availabilityStatus: 'unknown' })).toEqual({ ok: false });
    expect(parseAvailabilityPatchBody({ availabilityStatus: '' })).toEqual({ ok: false });
    expect(parseAvailabilityPatchBody({ availabilityStatus: null })).toEqual({ ok: false });
  });
});

describe('parseAssignHumanTaskBody', () => {
  it('accepts body with workforceMemberId only', () => {
    const result = parseAssignHumanTaskBody({ workforceMemberId: 'wm-1' });
    expect(result).toEqual({ ok: true, workforceMemberId: 'wm-1' });
  });

  it('accepts body with workforceQueueId only', () => {
    const result = parseAssignHumanTaskBody({ workforceQueueId: 'queue-1' });
    expect(result).toEqual({ ok: true, workforceQueueId: 'queue-1' });
  });

  it('accepts body with both ids', () => {
    const result = parseAssignHumanTaskBody({ workforceMemberId: 'wm-1', workforceQueueId: 'q-1' });
    expect(result).toEqual({ ok: true, workforceMemberId: 'wm-1', workforceQueueId: 'q-1' });
  });

  it('rejects body with neither id', () => {
    expect(parseAssignHumanTaskBody({})).toEqual({ ok: false });
  });

  it('rejects body with blank string ids', () => {
    expect(parseAssignHumanTaskBody({ workforceMemberId: '  ', workforceQueueId: '' })).toEqual({
      ok: false,
    });
  });

  it('rejects null', () => {
    expect(parseAssignHumanTaskBody(null)).toEqual({ ok: false });
  });

  it('rejects non-object', () => {
    expect(parseAssignHumanTaskBody('wm-1')).toEqual({ ok: false });
  });

  it('trims whitespace from ids', () => {
    const result = parseAssignHumanTaskBody({ workforceMemberId: '  wm-1  ' });
    expect(result).toEqual({ ok: true, workforceMemberId: 'wm-1' });
  });
});

describe('parseCompleteHumanTaskBody', () => {
  it('accepts null (no body)', () => {
    expect(parseCompleteHumanTaskBody(null)).toEqual({ ok: true });
  });

  it('accepts empty object (no completionNote)', () => {
    expect(parseCompleteHumanTaskBody({})).toEqual({ ok: true });
  });

  it('accepts body with valid completionNote', () => {
    const result = parseCompleteHumanTaskBody({ completionNote: 'All done' });
    expect(result).toEqual({ ok: true, completionNote: 'All done' });
  });

  it('trims completionNote and omits it when blank', () => {
    expect(parseCompleteHumanTaskBody({ completionNote: '   ' })).toEqual({ ok: true });
  });

  it('rejects non-object non-null values', () => {
    expect(parseCompleteHumanTaskBody('done')).toEqual({ ok: false });
    expect(parseCompleteHumanTaskBody(123)).toEqual({ ok: false });
  });

  it('ignores non-string completionNote', () => {
    const result = parseCompleteHumanTaskBody({ completionNote: 42 });
    expect(result).toEqual({ ok: true });
  });
});

describe('parseEscalateHumanTaskBody', () => {
  it('accepts body with required workforceQueueId', () => {
    const result = parseEscalateHumanTaskBody({ workforceQueueId: 'queue-1' });
    expect(result).toEqual({ ok: true, workforceQueueId: 'queue-1' });
  });

  it('accepts body with workforceQueueId and reason', () => {
    const result = parseEscalateHumanTaskBody({
      workforceQueueId: 'queue-1',
      reason: 'Needs supervisor',
    });
    expect(result).toEqual({ ok: true, workforceQueueId: 'queue-1', reason: 'Needs supervisor' });
  });

  it('rejects missing workforceQueueId', () => {
    expect(parseEscalateHumanTaskBody({})).toEqual({ ok: false });
  });

  it('rejects blank workforceQueueId', () => {
    expect(parseEscalateHumanTaskBody({ workforceQueueId: '   ' })).toEqual({ ok: false });
    expect(parseEscalateHumanTaskBody({ workforceQueueId: '' })).toEqual({ ok: false });
  });

  it('rejects null', () => {
    expect(parseEscalateHumanTaskBody(null)).toEqual({ ok: false });
  });

  it('rejects non-object', () => {
    expect(parseEscalateHumanTaskBody('queue-1')).toEqual({ ok: false });
  });

  it('trims workforceQueueId', () => {
    const result = parseEscalateHumanTaskBody({ workforceQueueId: '  queue-1  ' });
    expect(result).toEqual({ ok: true, workforceQueueId: 'queue-1' });
  });

  it('omits blank reason', () => {
    const result = parseEscalateHumanTaskBody({ workforceQueueId: 'q-1', reason: '  ' });
    expect(result).toEqual({ ok: true, workforceQueueId: 'q-1' });
  });
});
