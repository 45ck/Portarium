import { describe, expect, it } from 'vitest';

import { WorkspaceParseError, parseWorkspaceV1 } from './workspace-v1.js';

describe('parseWorkspaceV1', () => {
  it('parses a minimal workspace', () => {
    const ws = parseWorkspaceV1({
      workspaceId: 'ws-1',
      name: 'Acme',
      createdAtIso: '2026-02-16T00:00:00.000Z',
    });

    expect(ws.workspaceId).toBe('ws-1');
    expect(ws.name).toBe('Acme');
    expect(ws.createdAtIso).toBe('2026-02-16T00:00:00.000Z');
  });

  it('rejects invalid inputs', () => {
    expect(() => parseWorkspaceV1('nope')).toThrow(WorkspaceParseError);

    expect(() =>
      parseWorkspaceV1({
        workspaceId: 'ws-1',
        name: '   ',
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    ).toThrow(/name/i);
  });
});
