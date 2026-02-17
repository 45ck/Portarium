import { describe, expect, it } from 'vitest';

import { parseRunV1 } from './run-v1.js';

describe('parseRunV1: happy path', () => {
  it('parses a minimal RunV1', () => {
    const run = parseRunV1({
      schemaVersion: 1,
      runId: 'run-1',
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
      correlationId: 'corr-1',
      executionTier: 'Auto',
      initiatedByUserId: 'user-1',
      status: 'Pending',
      createdAtIso: '2026-02-17T00:00:00.000Z',
    });

    expect(run.schemaVersion).toBe(1);
    expect(run.runId).toBe('run-1');
    expect(run.status).toBe('Pending');
    expect(run.startedAtIso).toBeUndefined();
    expect(run.endedAtIso).toBeUndefined();
  });

  it('parses started and ended timestamps', () => {
    const run = parseRunV1({
      schemaVersion: 1,
      runId: 'run-2',
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
      correlationId: 'corr-2',
      executionTier: 'Assisted',
      initiatedByUserId: 'user-1',
      status: 'Succeeded',
      createdAtIso: '2026-02-17T00:00:00.000Z',
      startedAtIso: '2026-02-17T00:00:01.000Z',
      endedAtIso: '2026-02-17T00:00:10.000Z',
    });

    expect(run.status).toBe('Succeeded');
    expect(run.startedAtIso).toContain('00:00:01');
    expect(run.endedAtIso).toContain('00:00:10');
  });
});

describe('parseRunV1: validation', () => {
  it('rejects invalid top-level inputs and schema versions', () => {
    expect(() => parseRunV1('nope')).toThrow(/Run must be an object/i);
    expect(() => parseRunV1({ schemaVersion: 2 })).toThrow(/schemaVersion/i);
    expect(() => parseRunV1({ schemaVersion: 1.5 })).toThrow(/schemaVersion/i);
  });

  it('rejects invalid executionTier and status', () => {
    expect(() =>
      parseRunV1({
        schemaVersion: 1,
        runId: 'run-1',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        correlationId: 'corr-1',
        executionTier: 'SuperAuto',
        initiatedByUserId: 'user-1',
        status: 'Pending',
        createdAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/executionTier/i);

    expect(() =>
      parseRunV1({
        schemaVersion: 1,
        runId: 'run-1',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        correlationId: 'corr-1',
        executionTier: 'Auto',
        initiatedByUserId: 'user-1',
        status: 'Done',
        createdAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/status/i);
  });

  it('rejects invalid required and optional strings', () => {
    expect(() =>
      parseRunV1({
        schemaVersion: 1,
        runId: '   ',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        correlationId: 'corr-1',
        executionTier: 'Auto',
        initiatedByUserId: 'user-1',
        status: 'Pending',
        createdAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/runId/i);

    expect(() =>
      parseRunV1({
        schemaVersion: 1,
        runId: 'run-1',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        correlationId: 'corr-1',
        executionTier: 'Auto',
        initiatedByUserId: 'user-1',
        status: 'Pending',
        createdAtIso: '2026-02-17T00:00:00.000Z',
        startedAtIso: '   ',
      }),
    ).toThrow(/startedAtIso/i);
  });
});
