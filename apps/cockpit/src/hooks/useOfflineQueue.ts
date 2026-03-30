/**
 * useOfflineQueue — enqueue approval decisions when offline, drain on reconnect.
 *
 * Wraps the IndexedDB offline store and the localStorage-based approval outbox
 * into a single React hook that tracks online/offline state, pending count,
 * and provides enqueue + manual drain operations.
 *
 * Bead: bead-0946
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ApprovalDecisionRequest } from '@portarium/cockpit-types';
import {
  putPendingDecision,
  getPendingDecisions,
  removePendingDecision,
  countPendingDecisions,
  type PendingDecision,
} from '@/lib/offline-store';
import { CockpitApiError } from '@/lib/control-plane-client';

// ── Online state (shared singleton) ─────────────────────────────────────────

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

// ── Retry helpers ────────────────────────────────────────────────────────────

function buildIdempotencyKey(params: {
  workspaceId: string;
  approvalId: string;
  decision: ApprovalDecisionRequest;
}): string {
  const rationale = params.decision.rationale.trim().replace(/\s+/g, ' ').toLowerCase();
  return [params.workspaceId, params.approvalId, params.decision.decision, rationale].join(':');
}

function isRetryable(error: unknown): boolean {
  if (error instanceof CockpitApiError) {
    return (
      error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500
    );
  }
  return error instanceof TypeError;
}

function isTerminalConflict(error: unknown): boolean {
  return error instanceof CockpitApiError && error.status === 409;
}

function nextAttemptAt(now: Date, attemptCount: number): string {
  const delayMs = Math.min(1000 * 2 ** attemptCount, 30_000);
  return new Date(now.getTime() + delayMs).toISOString();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface OfflineQueueState {
  /** True when the browser reports being online. */
  isOnline: boolean;
  /** Number of pending approval decisions queued in IndexedDB. */
  pendingCount: number;
  /** Enqueue an approval decision for later delivery. */
  enqueue: (params: {
    workspaceId: string;
    approvalId: string;
    decision: ApprovalDecisionRequest;
  }) => Promise<void>;
  /** Manually trigger a drain of the offline queue. */
  drain: (params: {
    workspaceId: string;
    sendDecision: (entry: PendingDecision) => Promise<void>;
  }) => Promise<DrainResult>;
}

export interface DrainResult {
  processed: number;
  delivered: number;
  requeued: number;
  dropped: number;
}

export function useOfflineQueue(): OfflineQueueState {
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const drainInProgress = useRef(false);

  // Refresh pending count on mount and when online status changes
  const refreshCount = useCallback(async () => {
    try {
      const count = await countPendingDecisions();
      setPendingCount(count);
    } catch {
      // IndexedDB unavailable — keep existing count
    }
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [isOnline, refreshCount]);

  const enqueue = useCallback(
    async (params: {
      workspaceId: string;
      approvalId: string;
      decision: ApprovalDecisionRequest;
    }) => {
      const now = new Date();
      const idempotencyKey = buildIdempotencyKey(params);

      await putPendingDecision({
        idempotencyKey,
        workspaceId: params.workspaceId,
        approvalId: params.approvalId,
        decision: params.decision.decision,
        rationale: params.decision.rationale,
        queuedAt: now.toISOString(),
        attemptCount: 0,
        nextAttemptAt: now.toISOString(),
      });

      await refreshCount();
    },
    [refreshCount],
  );

  const drain = useCallback(
    async (params: {
      workspaceId: string;
      sendDecision: (entry: PendingDecision) => Promise<void>;
    }): Promise<DrainResult> => {
      if (drainInProgress.current) {
        return { processed: 0, delivered: 0, requeued: 0, dropped: 0 };
      }

      drainInProgress.current = true;
      const now = new Date();
      let processed = 0;
      let delivered = 0;
      let requeued = 0;
      let dropped = 0;

      try {
        const entries = await getPendingDecisions(params.workspaceId);

        for (const entry of entries) {
          if (new Date(entry.nextAttemptAt).getTime() > now.getTime()) {
            continue;
          }

          processed += 1;

          try {
            await params.sendDecision(entry);
            await removePendingDecision(entry.idempotencyKey);
            delivered += 1;
          } catch (error) {
            if (isTerminalConflict(error)) {
              await removePendingDecision(entry.idempotencyKey);
              delivered += 1;
              continue;
            }

            if (isRetryable(error)) {
              requeued += 1;
              await putPendingDecision({
                ...entry,
                attemptCount: entry.attemptCount + 1,
                nextAttemptAt: nextAttemptAt(now, entry.attemptCount + 1),
              });
              continue;
            }

            await removePendingDecision(entry.idempotencyKey);
            dropped += 1;
          }
        }
      } finally {
        drainInProgress.current = false;
        await refreshCount();
      }

      return { processed, delivered, requeued, dropped };
    },
    [refreshCount],
  );

  return { isOnline, pendingCount, enqueue, drain };
}
