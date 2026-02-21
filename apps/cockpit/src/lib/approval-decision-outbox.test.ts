// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CockpitApiError } from '@/lib/control-plane-client';
import {
  drainApprovalDecisionOutbox,
  enqueueApprovalDecisionOutbox,
  listApprovalDecisionOutbox,
} from '@/lib/approval-decision-outbox';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('approval decision outbox', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('deduplicates identical queued decisions', () => {
    enqueueApprovalDecisionOutbox({
      workspaceId: 'ws-1',
      approvalId: 'ap-1',
      decision: { decision: 'Approved', rationale: 'safe' },
    });
    enqueueApprovalDecisionOutbox({
      workspaceId: 'ws-1',
      approvalId: 'ap-1',
      decision: { decision: 'Approved', rationale: 'safe' },
    });

    expect(listApprovalDecisionOutbox('ws-1')).toHaveLength(1);
  });

  it('replays queued decisions and clears delivered entries', async () => {
    enqueueApprovalDecisionOutbox({
      workspaceId: 'ws-1',
      approvalId: 'ap-1',
      decision: { decision: 'Approved', rationale: 'safe' },
    });

    const sendDecision = vi.fn(async () => {});
    const result = await drainApprovalDecisionOutbox({
      workspaceId: 'ws-1',
      sendDecision,
    });

    expect(result).toEqual({ processed: 1, delivered: 1, requeued: 0, dropped: 0 });
    expect(sendDecision).toHaveBeenCalledTimes(1);
    expect(listApprovalDecisionOutbox('ws-1')).toHaveLength(0);
  });

  it('requeues retryable failures with next attempt scheduling', async () => {
    enqueueApprovalDecisionOutbox(
      {
        workspaceId: 'ws-1',
        approvalId: 'ap-1',
        decision: { decision: 'Approved', rationale: 'safe' },
      },
      { now: new Date('2026-02-21T00:00:00.000Z') },
    );

    const result = await drainApprovalDecisionOutbox({
      workspaceId: 'ws-1',
      now: new Date('2026-02-21T00:00:00.000Z'),
      sendDecision: async () => {
        throw new CockpitApiError(503, 'temporary');
      },
    });

    const [queued] = listApprovalDecisionOutbox('ws-1');
    expect(result).toEqual({ processed: 1, delivered: 0, requeued: 1, dropped: 0 });
    expect(queued?.attemptCount).toBe(1);
  });
});
