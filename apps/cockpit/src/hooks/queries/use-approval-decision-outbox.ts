import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApprovalDecisionRequest } from '@portarium/cockpit-types';
import { controlPlaneClient, CockpitApiError } from '@/lib/control-plane-client';
import {
  drainApprovalDecisionOutbox,
  enqueueApprovalDecisionOutbox,
  listApprovalDecisionOutbox,
} from '@/lib/approval-decision-outbox';

interface SubmitDecisionResult {
  queued: boolean;
}

function shouldQueueOnError(error: unknown): boolean {
  if (error instanceof CockpitApiError) {
    return (
      error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500
    );
  }
  return error instanceof TypeError;
}

export function useApprovalDecisionOutbox(workspaceId: string) {
  const queryClient = useQueryClient();
  const [isFlushing, setIsFlushing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(listApprovalDecisionOutbox(workspaceId).length);
  }, [workspaceId]);

  const flushNow = useCallback(async () => {
    if (!workspaceId || isFlushing) return;
    setIsFlushing(true);
    try {
      const result = await drainApprovalDecisionOutbox({
        workspaceId,
        sendDecision: async ({ workspaceId: wsId, approvalId, decision }) => {
          await controlPlaneClient.decideApproval(wsId, approvalId, decision);
        },
      });
      if (result.delivered > 0) {
        await queryClient.invalidateQueries({ queryKey: ['approvals', workspaceId] });
      }
    } finally {
      refreshPendingCount();
      setIsFlushing(false);
    }
  }, [isFlushing, queryClient, refreshPendingCount, workspaceId]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onOnline = () => {
      void flushNow();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushNow]);

  useEffect(() => {
    if (!workspaceId || pendingCount === 0) return undefined;
    const timer = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      void flushNow();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [flushNow, pendingCount, workspaceId]);

  const submitDecision = useCallback(
    async (
      approvalId: string,
      decision: ApprovalDecisionRequest,
    ): Promise<SubmitDecisionResult> => {
      if (!workspaceId) return { queued: false };

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueApprovalDecisionOutbox({ workspaceId, approvalId, decision });
        refreshPendingCount();
        return { queued: true };
      }

      try {
        await controlPlaneClient.decideApproval(workspaceId, approvalId, decision);
        await queryClient.invalidateQueries({ queryKey: ['approvals', workspaceId] });
        return { queued: false };
      } catch (error) {
        if (!shouldQueueOnError(error)) {
          throw error;
        }
        enqueueApprovalDecisionOutbox({ workspaceId, approvalId, decision });
        refreshPendingCount();
        return { queued: true };
      }
    },
    [queryClient, refreshPendingCount, workspaceId],
  );

  return useMemo(
    () => ({
      submitDecision,
      pendingCount,
      isFlushing,
      flushNow,
    }),
    [flushNow, isFlushing, pendingCount, submitDecision],
  );
}
