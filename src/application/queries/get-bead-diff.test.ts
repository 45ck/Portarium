import { describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../common/context.js';
import type { AuthorizationPort, BeadDiffStore } from '../ports/index.js';
import { getBeadDiff } from './get-bead-diff.js';

const HUNKS = [
  {
    hunkId: 'hunk-1',
    filePath: 'README.md',
    changeType: 'modified' as const,
    oldStart: 1,
    oldCount: 1,
    newStart: 1,
    newCount: 1,
    lines: [{ op: 'add' as const, content: 'hello', newLineNumber: 1 }],
  },
];

function ctx() {
  return toAppContext({
    tenantId: 'ws-1',
    principalId: 'user-1',
    correlationId: 'corr-1',
    roles: ['operator'],
  });
}

describe('getBeadDiff', () => {
  it('returns hunks when present', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const beadDiffStore: BeadDiffStore = { getBeadDiff: vi.fn(async () => HUNKS) };

    const result = await getBeadDiff({ authorization, beadDiffStore }, ctx(), {
      workspaceId: 'ws-1',
      beadId: 'bead-0976',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.hunkId).toBe('hunk-1');
    expect(beadDiffStore.getBeadDiff).toHaveBeenCalledWith('ws-1', 'ws-1', 'bead-0976');
  });

  it('returns forbidden when caller lacks work-item read access', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => false) };
    const beadDiffStore: BeadDiffStore = { getBeadDiff: vi.fn(async () => HUNKS) };

    const result = await getBeadDiff({ authorization, beadDiffStore }, ctx(), {
      workspaceId: 'ws-1',
      beadId: 'bead-0976',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });

  it('returns validation failed for blank ids', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const beadDiffStore: BeadDiffStore = { getBeadDiff: vi.fn(async () => HUNKS) };

    const result = await getBeadDiff({ authorization, beadDiffStore }, ctx(), {
      workspaceId: '',
      beadId: '',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
  });

  it('returns not found when the store has no diff', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const beadDiffStore: BeadDiffStore = { getBeadDiff: vi.fn(async () => null) };

    const result = await getBeadDiff({ authorization, beadDiffStore }, ctx(), {
      workspaceId: 'ws-1',
      beadId: 'bead-missing',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('NotFound');
  });
});
