// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the offline-store module since jsdom doesn't provide IndexedDB
const mockStore = new Map<string, { idempotencyKey: string; [k: string]: unknown }>();

vi.mock('@/lib/offline-store', () => ({
  putPendingDecision: vi.fn(async (entry: { idempotencyKey: string }) => {
    mockStore.set(entry.idempotencyKey, entry);
  }),
  getPendingDecisions: vi.fn(async (wsId: string) => {
    return [...mockStore.values()].filter((e) => e.workspaceId === wsId);
  }),
  removePendingDecision: vi.fn(async (key: string) => {
    mockStore.delete(key);
  }),
  countPendingDecisions: vi.fn(async () => mockStore.size),
  getAllPendingDecisions: vi.fn(async () => [...mockStore.values()]),
  deleteOfflineDatabase: vi.fn(async () => mockStore.clear()),
}));

import { useOfflineQueue } from '@/hooks/useOfflineQueue';

describe('useOfflineQueue', () => {
  beforeEach(() => {
    mockStore.clear();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
  });

  it('reports online state', () => {
    const { result } = renderHook(() => useOfflineQueue());
    expect(result.current.isOnline).toBe(true);
  });

  it('starts with zero pending count', async () => {
    const { result } = renderHook(() => useOfflineQueue());
    // Wait for initial count refresh
    await act(async () => {});
    expect(result.current.pendingCount).toBe(0);
  });

  it('increments pending count after enqueue', async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.enqueue({
        workspaceId: 'ws-1',
        approvalId: 'ap-1',
        decision: { decision: 'Approved', rationale: 'safe' },
      });
    });

    expect(result.current.pendingCount).toBe(1);
  });

  it('drains queued decisions successfully', async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.enqueue({
        workspaceId: 'ws-1',
        approvalId: 'ap-1',
        decision: { decision: 'Approved', rationale: 'safe' },
      });
    });

    expect(result.current.pendingCount).toBe(1);

    const sendDecision = vi.fn(async () => {});
    let drainResult: { processed: number; delivered: number; requeued: number; dropped: number };

    await act(async () => {
      drainResult = await result.current.drain({
        workspaceId: 'ws-1',
        sendDecision,
      });
    });

    expect(drainResult!.delivered).toBe(1);
    expect(drainResult!.processed).toBe(1);
    expect(sendDecision).toHaveBeenCalledTimes(1);
    expect(result.current.pendingCount).toBe(0);
  });

  it('deduplicates identical enqueue calls (put overwrites)', async () => {
    const { result } = renderHook(() => useOfflineQueue());

    const params = {
      workspaceId: 'ws-1',
      approvalId: 'ap-1',
      decision: { decision: 'Approved' as const, rationale: 'safe' },
    };

    await act(async () => {
      await result.current.enqueue(params);
      await result.current.enqueue(params);
    });

    expect(result.current.pendingCount).toBe(1);
  });

  it('handles terminal 409 conflict as delivered', async () => {
    const { CockpitApiError } = await import('@/lib/control-plane-client');
    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.enqueue({
        workspaceId: 'ws-1',
        approvalId: 'ap-1',
        decision: { decision: 'Approved', rationale: 'safe' },
      });
    });

    const sendDecision = vi.fn(async () => {
      throw new CockpitApiError(409, 'conflict');
    });

    let drainResult: { processed: number; delivered: number; requeued: number; dropped: number };

    await act(async () => {
      drainResult = await result.current.drain({
        workspaceId: 'ws-1',
        sendDecision,
      });
    });

    expect(drainResult!.delivered).toBe(1);
    expect(result.current.pendingCount).toBe(0);
  });
});
